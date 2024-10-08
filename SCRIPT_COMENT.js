const allContent = []; // Array para armazenar todas as postagens e comentários coletados.
const maxPosts = 50; // Número máximo de posts a serem processados
let processedPosts = 0; // Contador de posts processados

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
        // Wrap all fields, including those without commas, in double quotes
        return `"${(value + '').replace(/"/g, '""')}"`;
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
  return new Promise((resolve) => {
    let lastScrollHeight = document.documentElement.scrollHeight;
    let scrollAttempts = 0;
    const maxScrollAttempts = 5;

    const scrollInterval = setInterval(() => {
      wrapper.scrollTo(0, document.documentElement.scrollHeight);
      scrollAttempts++;

      setTimeout(() => {
        if (document.documentElement.scrollHeight > lastScrollHeight || scrollAttempts >= maxScrollAttempts) {
          clearInterval(scrollInterval);
          console.log('Scroll concluído ou limite de tentativas atingido');
          resolve();
        } else {
          lastScrollHeight = document.documentElement.scrollHeight;
        }
      }, 1000);
    }, 1500);
  });
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
        return true;
      }
    }
  }
  return false;
}

function getAllPosts() {
  const feedPosts = document.querySelectorAll('div[role="feed"] > div');
  
  const filteredPosts = [...feedPosts].filter(post => {
    const hasAuthorOrTitle = post.querySelector('h2, h3, span');
    const hasContent = post.querySelector('p, div[role="article"], div[dir="auto"]');
    
    return hasAuthorOrTitle && hasContent && post.textContent.trim().length > 0;
  });

  console.log(`Encontrados ${filteredPosts.length} posts válidos`);
  
  return filteredPosts.map(post => {
    const postTextElements = post.querySelectorAll('div[dir="auto"]');
    let postText = '';
    postTextElements.forEach((element) => {
      postText += element.textContent + ' ';
    });
    
    const authorElement = post.querySelector('h2, h3, span');
    const postAuthor = authorElement ? authorElement.textContent : 'Desconhecido';
    
    const postId = post.getAttribute('id') || 'id-desconhecido';
    
    const postData = {
      postId,
      postText: postText.trim(),
      postAuthor: postAuthor,
      postAuthorId: '',
      postAuthorUrl: '',
    };
    
    if (!allContent.some(item => item.postId === postData.postId)) {
      allContent.push(postData);
    }
    return post;
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function closeDialog() {
  const closeButton = document?.querySelector('div[aria-label="Fechar"], div[aria-label="Close"]');
  if (closeButton) {
    closeButton.click();
  }
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

function addCommentsToAllContent(comments = []) {
  comments.forEach((c) => {
    if (!allContent.some(item => item.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}

function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (url && url.includes('graphql')) {
      let requestBody = null;
      const oldXHRSend = this.send;

      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      this.addEventListener('load', function () {
        if (requestBody && requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
          console.log('Obtendo posts');
          const payload = this.responseText;
          const lines = payload.split('\n');

          lines.forEach((line, index) => {
            try {
              const data = JSON.parse(line);
              const post = parsePostData(data);
              console.log(`Post ${index + 1}:`, post.post.postText);
              if (!allContent.some(item => item.postId === post.post.postId)) {
                allContent.push(post.post);
              }
              addCommentsToAllContent(post.topLevelComments);
            } catch (e) {
              console.error(`Erro ao processar linha ${index + 1}:`, e);
            }
          });

        } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
          console.log('Obtendo comentários');
          let data;
          try {
            data = JSON.parse(this.responseText);
          } catch (e) {
            console.error('Erro ao analisar JSON:', e);
          }

          if (data && data.data) {
            const postId = data.data.story_card?.post_id;
            const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
              ?.comment_rendering_instance_for_feed_location?.comments?.edges?.map(blah => {
                const comment = blah.node;
                const timeStuff = comment?.comment_action_links?.find(
                  (f) => f?.__typename === 'XFBCommentTimeStampActionLink',
                )?.comment;
                return {
                  id: comment?.id,
                  commentId: comment?.id,
                  postId,
                  commentText: comment?.body?.text,
                  commentAuthorName: comment?.author?.name,
                  commentAuthorId: comment?.author?.id,
                  commentAuthorUrl: comment?.author?.url,
                  timestamp: timeStuff?.created_time,
                  commentUrl: timeStuff?.url,
                  email: getEmailFromText(comment?.body?.text),
                  firstName: comment?.author?.name?.split(' ')?.[0],
                  lastName: comment?.author?.name?.split(' ')?.[1],
                };
              });
            addCommentsToAllContent(comments);
            console.log('Comentários:', comments);
          }
        }
      });
    }

    return oldXHROpen.apply(this, arguments);
  };
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
      ?.story?.feedback_context?.interesting_top_level_comments,
  );

  return {
    post,
    topLevelComments,
  };
}

async function run() {
  interceptRequests();
  console.log('Iniciando...');
  
  let lastPostCount = 0;
  let noNewPostsCount = 0;
  const maxNoNewPosts = 3;
  
  while (processedPosts < maxPosts) {
    await scrollDown();
    let posts = getAllPosts();
    console.log('Número de posts:', posts.length);
    
    if (posts.length === lastPostCount) {
      noNewPostsCount++;
      if (noNewPostsCount >= maxNoNewPosts) {
        console.log('Nenhum novo post carregado após várias tentativas. Finalizando...');
        break;
      }
    } else {
      noNewPostsCount = 0;
    }
    
    lastPostCount = posts.length;
    
    for (let i = 0; i < posts.length && processedPosts < maxPosts; i++) {
      const post = posts[i];
      console.log(`Processando post ${processedPosts + 1}`);
      
      if (clickOnComments(post)) {
        await sleep(3000);
        closeDialog();
      }
      
      processedPosts++;
      
      if (processedPosts % 5 === 0) {
        await scrollDown();
        posts = getAllPosts();
      }
      
      await sleep(2000);
    }
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('Conteúdo coletado:', allContent);
  console.log('Concluído!');
  console.log(`Dados de ${allContent.length} itens coletados.`);
}

await run();