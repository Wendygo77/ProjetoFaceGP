const allContent = [] // Armazena os dados coletados dos posts e comentários

function createCSV(data, fileName) { 
  const headers = [
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor', 'postAuthorId', 
    'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName', 'commentAuthorId', 
    'commentAuthorUrl', 'timestamp', 'commentUrl'
  ];

  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        return value === null ? 'null' : `"${(typeof value === 'string' ? value.replace(/"/g, '""') : value)}"`;
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
  await new Promise((resolve) => {
    let distance = 800;
    let timer = setInterval(() => {
      wrapper.scrollBy(0, distance);
      clearInterval(timer);
      resolve();
    }, 400);
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text?.match(emailRegex)?.[0] || '';
}

function clickOnComments(post) {
  var allDivs = post.getElementsByTagName('div');
  for (let i = 0; i < allDivs.length; i++) {
    if (allDivs[i].getAttribute('data-visualcompletion') === 'ignore-dynamic') {
      const thingToClick = allDivs?.[i]?.children?.[0]?.children?.[1]?.children?.[0];
      if (thingToClick) {
        thingToClick.click();
      }
    }
  }
}

function getAllPosts() {
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => 
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

function formatTopLevelComments(postId, topLevelComments = []) {
  return topLevelComments.map((c) => {
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

function parsePostData(json, level = 1) {
  const actor = json?.data?.node?.[`comet_sections${level > 1 ? '.content' : ''}`]?.story?.comet_sections?.actor_photo?.story?.actors?.[0];
  const postText = json?.data?.node?.comet_sections?.content?.story?.comet_sections?.message_container?.story?.message?.text;
  const postId = json?.data?.node?.comet_sections?.feedback?.story?.post_id;
  
  const post = {
    id: postId, postId, postText: postText || '', postAuthor: actor?.name,
    postAuthorId: actor?.id, postAuthorUrl: actor?.url,
    email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0], lastName: actor?.name?.split(' ')?.[1]
  };

  const topLevelComments = formatTopLevelComments(postId, json?.data?.node?.comet_sections?.feedback?.story?.feedback_context?.interesting_top_level_comments);

  return { post, topLevelComments };
}

function addCommentsToAllContent(comments = []) {
  comments.forEach((c) => {
    if (!allContent?.find((f) => f.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}

function interceptRequests() {
  let oldXHROpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (!url.includes('graphql')) {
      return oldXHROpen.apply(this, arguments);
    }
    
    let requestBody = null;
    let oldXHRSend = this.send;
    this.send = function (data) {
      requestBody = data;
      oldXHRSend.apply(this, arguments);
    }

    this.addEventListener('load', function () {
      if (requestBody?.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
        const payload = this.responseText.split('\n')[0];
        const postData = parsePostData(JSON.parse(payload));
        allContent.push(postData.post);
        addCommentsToAllContent(postData.topLevelComments);
      }
    });

    return oldXHROpen.apply(this, arguments);
  }
}

async function run() {
  interceptRequests();
  let posts = getAllPosts();
  let i = 0;

  while (i < posts.length) {
    const post = posts[i];
    clickOnComments(post);
    await sleep(1000);
    closeDialog();
    i++;
    if (scrolls > 0) {
      await scrollDown();
      scrolls--;
      posts = getAllPosts();
    }
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
}

let scrolls = 10;
await run();
