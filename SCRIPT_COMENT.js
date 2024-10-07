const allContent = []; // Array para armazenar todas as postagens e comentários coletados.
const maxPosts = 50; // Define o número máximo de postagens a serem processadas.
let processedPosts = 0; // Variável para contar quantas postagens foram processadas.

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
  await new Promise((resolve, reject) => {
    var totalHeight = 0;
    var distance = 800;

    var timer = setInterval(async () => {
      wrapper.scrollBy(0, distance);
      totalHeight += distance;

      clearInterval(timer);
      resolve();
    }, 400);
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));
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
        return 'Comentário clicado com sucesso';
      }
    }
  }
  return 'Botão de comentários não encontrado';
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
  const closeButton = document?.querySelector('div[aria-label="Fechar"]');
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
          const payload = this.responseText;
          const lines = payload.split('\n');

          if (lines.length >= 3 && processedPosts < maxPosts) {
            const firstPost = parsePostData(JSON.parse(lines[0]));
            if (!allContent.some(item => item.postId === firstPost.post.postId)) {
              allContent.push(firstPost.post);
            }
            addCommentsToAllContent(firstPost.topLevelComments);
            processedPosts++;

            const secondPost = parsePostData(JSON.parse(lines[1]));
            if (!allContent.some(item => item.postId === secondPost.post.postId)) {
              allContent.push(secondPost.post);
            }
            addCommentsToAllContent(secondPost.topLevelComments);
            processedPosts++;

            const thirdPost = parsePostData(JSON.parse(lines[2]));
            if (!allContent.some(item => item.postId === thirdPost.post.postId)) {
              allContent.push(thirdPost.post);
            }
            addCommentsToAllContent(thirdPost.topLevelComments);
            processedPosts++;
          }
        } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
          let data;
          try {
            data = JSON.parse(this.responseText);
          } catch (e) {
            console.error('Erro ao analisar JSON:', e);
          }

          if (data && data.data && processedPosts < maxPosts) {
            const postId = data.data.story_card?.post_id;
            const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
              ?.comment_rendering_instance_for_feed_location?.comments?.edges?.map(blah => {
                const comment = blah.node;
                return {
                  id: comment?.id,
                  commentId: comment?.id,
                  postId,
                  commentText: comment?.body?.text,
                  commentAuthorName: comment?.author?.name,
                  commentAuthorId: comment?.author?.id,
                  commentAuthorUrl: comment?.author?.url,
                  email: getEmailFromText(comment?.body?.text),
                  firstName: comment?.author?.name?.split(' ')?.[0],
                  lastName: comment?.author?.name?.split(' ')?.[1],
                };
              });
            addCommentsToAllContent(comments);
            processedPosts++;
          }
        }
      });
    }

    return oldXHROpen.apply(this, arguments);
  };
}

async function run() {
  interceptRequests();
  console.log('Iniciando...');
  let posts = getAllPosts();
  console.log('Número de posts:', posts.length);
  let i = 0;
  let scrolls = 1000;

  while (i < posts.length && processedPosts < maxPosts) {
    const post = posts[i];
    console.log('Processando post', i + 1);
    clickOnComments(post);
    await sleep(1000);
    closeDialog();

    i++;
    if (scrolls > 0) {
      await scrollDown();
      scrolls--;
      console.log('Rolagens restantes:', scrolls);
      console.log('Posts antigos:', posts.length);
      const currentPosts = getAllPosts();
      console.log('Posts atuais:', currentPosts.length);
      posts = currentPosts;
    }
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('Conteúdo coletado:', allContent);
  console.log('Concluído!');
  console.log(`Dados de ${processedPosts} posts coletados.`);
}

await run();