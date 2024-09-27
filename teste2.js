const allContent = new Set(); // Set para armazenar postagens e comentários únicos
const maxPosts = 200; // Limite máximo de postagens a serem processadas
let processedPosts = 0; // Contador de postagens processadas

// Função para criar o CSV
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
      }).join(',')
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

// Função para extrair e-mails de um texto
function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || '';
}

// Função para clicar em comentários
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

// Função para coletar postagens do feed
function getAllPosts() {
  const feedPosts = document.querySelectorAll('div[role="feed"] > div');

  return [...feedPosts].filter(post => {
    const hasAuthorOrTitle = post.querySelector('h2, h3, span');
    const hasContent = post.querySelector('p, div[role="article"], div[dir="auto"]');
    return hasAuthorOrTitle && hasContent && post.textContent.trim().length > 0;
  }).map(post => {
    const postTextElements = post.querySelectorAll('div[dir="auto"]');
    let postText = '';
    postTextElements.forEach(element => postText += element.textContent + ' ');

    const authorElement = post.querySelector('h2, h3, span');
    const postAuthor = authorElement ? authorElement.textContent : 'Desconhecido';
    const postId = post.getAttribute('id') || 'id-desconhecido';

    const postData = {
      postId,
      postText: postText.trim(),
      postAuthor: postAuthor,
      postAuthorId: '', // ID do autor pode ser adicionado, se disponível
      postAuthorUrl: '', // URL do perfil do autor, se disponível
    };

    allContent.add(JSON.stringify(postData));
    return post;
  });
}

// Função para adicionar comentários ao Set
function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    allContent.add(JSON.stringify(c));
  });
}

// Função para interceptar requisições GraphQL
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (url && /graphql/i.test(url)) {
      let requestBody = null;
      const oldXHRSend = this.send;

      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      this.addEventListener('load', function () {
        setTimeout(() => {
          try {
            const responseText = this.responseText;

            if (!responseText || typeof responseText !== 'string') {
              console.warn('Resposta vazia ou inválida:', responseText);
              return;
            }

            const lines = responseText.split('\n').filter(line => line.trim());

            if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
              if (lines.length >= 3 && processedPosts < maxPosts) {
                lines.slice(0, 3).forEach((line, index) => {
                  try {
                    const postData = JSON.parse(line);
                    const postText = deepFind(postData, 'postText') || 'Texto não encontrado';
                    const postAuthor = deepFind(postData, 'postAuthor') || 'Autor desconhecido';
                    const postAuthorId = deepFind(postData, 'postAuthorId') || 'ID desconhecido';

                    const parsedData = {
                      postId: `post_${processedPosts}`,
                      postText: postText,
                      postAuthor: postAuthor,
                      postAuthorId: postAuthorId,
                    };

                    allContent.add(JSON.stringify(parsedData));
                    processedPosts++;
                  } catch (error) {
                    console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                  }
                });
              }
            } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
              let data;
              try {
                data = JSON.parse(responseText);
              } catch (error) {
                console.error('Erro ao analisar JSON da resposta:', error);
                return;
              }

              if (data?.data && processedPosts < maxPosts) {
                const postId = data.data.story_card?.post_id;
                const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                  ?.comment_rendering_instance_for_feed_location?.comments?.edges;

                if (Array.isArray(comments)) {
                  const formattedComments = comments.map(blah => {
                    const comment = blah.node;
                    return {
                      commentId: comment?.id,
                      postId,
                      commentText: comment?.body?.text || 'Texto não disponível',
                      commentAuthorName: comment?.author?.name || 'Autor desconhecido',
                      commentAuthorId: comment?.author?.id || '',
                      commentAuthorUrl: comment?.author?.url || '',
                      email: getEmailFromText(comment?.body?.text),
                      firstName: comment?.author?.name?.split(' ')?.[0] || 'Desconhecido',
                      lastName: comment?.author?.name?.split(' ')?.[1] || '',
                    };
                  });
                  addCommentsToAllContent(formattedComments);
                  processedPosts++;
                } else {
                  console.warn('Comentários não disponíveis ou em formato inesperado.');
                }
              }
            }
          } catch (error) {
            console.error('Erro ao interceptar a requisição:', error);
          }
        }, 1000);
      });
    }

    oldXHROpen.apply(this, arguments);
  };
}

// Função principal
async function run() {
  interceptRequests();
  console.log('Iniciando...');

  let posts = getAllPosts();
  let i = 0;

  while (i < posts.length && processedPosts < maxPosts) {
    const post = posts[i];
    clickOnComments(post);
    await new Promise(resolve => setTimeout(resolve, 1000));
    i++;
  }

  const formattedContent = Array.from(allContent).map(JSON.parse);
  createCSV(formattedContent, 'facebookGroupPostsAndComments.csv');
  console.log('Finalizado!');
}

run();
