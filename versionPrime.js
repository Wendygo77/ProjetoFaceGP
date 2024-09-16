const allContent = [];

function createCSV(data, fileName) {
  const headers = [
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl',
  ];

  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null) return 'null';
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, fileName);
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName || 'data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

async function scrollDown() {
  const wrapper = window;
  await new Promise(resolve => {
    let totalHeight = 0;
    const distance = 800;

    const timer = setInterval(() => {
      const scrollHeightBefore = wrapper.scrollHeight;
      wrapper.scrollBy(0, distance);
      totalHeight += distance;
      clearInterval(timer);
      resolve();
    }, 400);
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
}

function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || '';
}

function clickOnComments(post) {
  const allDivs = post.getElementsByTagName('div');
  for (let i = 0; i < allDivs.length; i++) {
    if (allDivs[i].getAttribute('data-visualcompletion') === 'ignore-dynamic') {
      const thingToClickToOpenComments =
        allDivs[i]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]
          ?.children?.[0]?.children?.[1]?.children?.[1]?.children?.[0]
          ?.children?.[0];
      if (thingToClickToOpenComments) {
        thingToClickToOpenComments.click();
      }
    }
  }
}

function traverseElementsToGetText(element) {
  let textArray = [];
  if (element.childNodes.length > 0) {
    for (let i = 0; i < element.childNodes.length; i++) {
      textArray = textArray.concat(traverseElementsToGetText(element.childNodes[i]));
    }
  } else if (element.nodeType === Node.TEXT_NODE && element.nodeValue.trim() !== '') {
    textArray.push(element.nodeValue.trim());
  }
  return textArray;
}

function getAllPosts() {
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post =>
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

function closeDialog() {
  const closeButton = document?.querySelector('div[aria-label="Close"]');
  if (closeButton) {
    closeButton.click();
  }
}

function formatTopLevelComments(postId, topLevelComments = []) {
  return topLevelComments.map(c => {
    const text = c?.comment.body.text;
    const commentId = c?.comment.id;
    const authorName = c?.comment.author.name;
    const authorId = c?.comment.author.id;
    return {
      id: commentId,
      commentId,
      postId,
      commentText: text || '',
      commentAuthorName: authorName,
      commentAuthorId: authorId,
      email: getEmailFromText(text),
      firstName: authorName?.split(' ')?.[0],
      lastName: authorName?.split(' ')?.[1],
    };
  });
}

function parsePostData(json) {
  const actor = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];
  const postText = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.message_container?.story?.message?.text;
  const postId = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
    ?.story?.post_id;

  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: actor?.name,
    postAuthorId: actor?.id,
    postAuthorUrl: actor?.url,
    email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0],
    lastName: actor?.name?.split(' ')?.[1],
  };

  const topLevelComments = formatTopLevelComments(
    postId,
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.feedback_context?.interesting_top_level_comments
  );

  return {
    post,
    topLevelComments,
  };
}

function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (!allContent.find(f => f.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}

function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (!url.includes('graphql')) {
      return oldXHROpen.apply(this, arguments);
    }

    let requestBody = null;
    const oldXHRSend = this.send;
    this.send = function (data) {
      requestBody = data;
      oldXHRSend.apply(this, arguments);
    };

    this.addEventListener('load', function () {
      if (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
        const payload = this.responseText;
        const lines = payload.split('\n');

        const firstPost = parsePostData(JSON.parse(lines[0]));
        allContent.push(firstPost.post);
        addCommentsToAllContent(firstPost.topLevelComments);
        
        const secondPost = parsePostData(JSON.parse(lines[1]));
        allContent.push(secondPost.post);
        addCommentsToAllContent(secondPost.topLevelComments);

        const thirdPost = parsePostData(JSON.parse(lines[2]));
        allContent.push(thirdPost.post);
        addCommentsToAllContent(thirdPost.topLevelComments);
      } else if (requestBody.includes('CometFocusedStoryViewUFIQuery')) {
        let data;
        try {
          data = JSON.parse(this.responseText);
        } catch (e) {}
        const postId = data?.data?.story_card?.post_id;
        const comments = data?.data?.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
          ?.comment_rendering_instance_for_feed_location?.comments?.edges?.map(blah => {
            const comment = blah?.node;
            const commentId = comment?.id;
            const commentText = comment?.body?.text;
            const authorName = comment?.author?.name;
            const authorId = comment?.author?.id;
            const authorUrl = comment?.author?.url;
            const timeStuff = comment?.comment_action_links?.find(f => f?.__typename === 'XFBCommentTimeStampActionLink')?.comment;
            const timestamp = timeStuff?.created_time;
            const commentUrl = timeStuff?.url;
            return {
              id: commentId,
              commentId,
              postId,
              commentText,
              commentAuthorName: authorName,
              commentAuthorId: authorId,
              commentAuthorUrl: authorUrl,
              timestamp,
              commentUrl,
              email: getEmailFromText(commentText),
              firstName: authorName?.split(' ')?.[0],
              lastName: authorName?.split(' ')?.[1],
            };
          });
        addCommentsToAllContent(comments);
      }
    });

    return oldXHROpen.apply(this, arguments);
  }
}

async function run() {
  interceptRequests();
  console.log('starting...');
  let posts = getAllPosts();
  let i = 0;

  while (i < posts.length) {
    const post = posts[i];
    clickOnComments(post);
    await new Promise(resolve => setTimeout(resolve, 1000));
    closeDialog();

    i++;
    if (scrolls > 0) {
      await scrollDown();
      scrolls--;
      const currentPosts = getAllPosts();
      posts = currentPosts;
    }
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('done!');
}

let scrolls = 10;
await run();
