const allContent = []; // Array para armazenar todas as postagens e comentários coletados.
const maxPosts = 10; // Define o número máximo de postagens a serem processadas.
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
  // Seleciona todos os elementos div que são filhos diretos do elemento com role="feed"
  const feedPosts = document.querySelectorAll('div[role="feed"] > div');
  
  // Filtra os posts para garantir que tenham conteúdo válido
  const filteredPosts = [...feedPosts].filter(post => {
    const hasAuthorOrTitle = post.querySelector('h2, h3, span');
    const hasContent = post.querySelector('p, div[role="article"], div[dir="auto"]');
    
    return hasAuthorOrTitle && hasContent && post.textContent.trim().length > 0;
  });

  console.log(`Encontrados ${filteredPosts.length} posts válidos`);
  
  // Mapeia os posts filtrados para extrair informações relevantes
  return filteredPosts.map(post => {
    // Extração do texto do post
    const postTextElements = post.querySelectorAll('div[dir="auto"]');
    let postText = '';
    postTextElements.forEach((element) => {
      postText += element.textContent + ' ';
    });
    
    // Autor do post (se disponível)
    const authorElement = post.querySelector('h2, h3, span');
    const postAuthor = authorElement ? authorElement.textContent : 'Desconhecido';
    
    const postId = post.getAttribute('id') || 'id-desconhecido';
    
    // Cria um objeto com os dados do post
    const postData = {
      postId,
      postText: postText.trim(),
      postAuthor: postAuthor,
      postAuthorId: '', // ID do autor pode ser adicionado, se disponível
      postAuthorUrl: '', // URL do perfil do autor, se disponível
    };
    
    // Adiciona o post ao array allContent
    allContent.push(postData);
    return post;
  });
}

function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (!allContent.find(f => f.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}

function parsePostData(json) {
  const actor = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];

  const postText = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.message_container?.story?.message?.text || '';

  const postId = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
    ?.story?.post_id || '';

  const post = {
    id: postId,
    postId,
    postText,
    postAuthor: actor?.name || 'Desconhecido',
    postAuthorId: actor?.id || '',
    postAuthorUrl: actor?.url || '',
    email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0] || 'Desconhecido',
    lastName: actor?.name?.split(' ')?.[1] || '',
  };

  const topLevelComments = formatTopLevelComments(
    postId,
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.feedback_context?.interesting_top_level_comments || []
  );

  return {
    post,
    topLevelComments,
  };
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
            allContent.push(firstPost.post);
            addCommentsToAllContent(firstPost.topLevelComments);
            processedPosts++;

            const secondPost = parsePostData(JSON.parse(lines[1]));
            allContent.push(secondPost.post);
            addCommentsToAllContent(secondPost.topLevelComments);
            processedPosts++;

            const thirdPost = parsePostData(JSON.parse(lines[2]));
            allContent.push(thirdPost.post);
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
  console.log('starting...');
  
  let posts = getAllPosts();
  let i = 0;

  while (i < posts.length && processedPosts < maxPosts) {
    const post = posts[i];
    clickOnComments(post);
    await new Promise(resolve => setTimeout(resolve, 1000));

    i++;
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('done!');
}

await run();