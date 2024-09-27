const allContent = []; // Array para armazenar todas as postagens e comentários coletados.
const maxPosts = 60; // Define o número máximo de postagens a serem processadas.
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
  // Seleciona todas as postagens no feed de forma mais abrangente
  const feedPosts = document.querySelectorAll('div[role="feed"] > div');
  
  return [...feedPosts].filter(post => {
    // Verifica se o post contém elementos que indicam uma postagem válida (autor ou texto)
    const hasAuthorOrTitle = post.querySelector('h2, h3, span');
    const hasContent = post.querySelector('p, div[role="article"], div[dir="auto"]');
    
    // Verifica se o post não está vazio e se contém conteúdo de texto significativo
    return hasAuthorOrTitle && hasContent && post.textContent.trim().length > 0;
  });
}

//function getAllPosts() {
  //const posts = document.querySelectorAll('div[role=feed] > div');
  //return [...posts].filter(post =>
    //post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  //);
//}

function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (!allContent.find(f => f.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}
function parsePostData(json) {
  try {
    // Verifica se o JSON tem a estrutura básica esperada
    if (!json || !json.data) {
      console.error('JSON inválido ou sem dados:', json);
      return { post: null, topLevelComments: [] };
    }

    const feedEdges = json.data.node?.group_feed?.edges;
    if (!feedEdges || feedEdges.length === 0) {
      console.error('Feed edges não encontrados no JSON:', json);
      return { post: null, topLevelComments: [] };
    }

    const postNode = feedEdges[0].node;
    if (!postNode) {
      console.error('Postagem não encontrada no JSON:', feedEdges);
      return { post: null, topLevelComments: [] };
    }

    // Obtém os dados do autor da postagem
    const actor = postNode?.comet_sections?.content?.story?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];

    // Obtém o texto da postagem
    const postText = postNode?.comet_sections?.content?.story?.comet_sections?.message_container?.story?.message?.text || '';

    // Obtém o ID da postagem
    const postId = postNode?.comet_sections?.feedback?.story?.post_id || '';

    // Log de advertência se o ID da postagem não for encontrado
    if (!postId) {
      console.warn('ID da postagem não encontrado:', postNode);
    }

    // Cria o objeto da postagem
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

    // Obtém os comentários de nível superior da postagem
    const topLevelComments = formatTopLevelComments(
      postId,
      postNode?.comet_sections?.feedback?.story?.feedback_context?.interesting_top_level_comments || []
    );

    // Log de advertência se o texto da postagem estiver vazio
    if (postText.length === 0) {
      console.warn('Texto da postagem vazio para o postId:', postId);
    }

    return {
      post,
      topLevelComments,
    };
  } catch (error) {
    // Log detalhado de erro, incluindo o JSON original
    console.error('Erro ao analisar o JSON na função parsePostData:', error, json);
    return { post: null, topLevelComments: [] };
  }
}
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    // Expressão regular para garantir que toda requisição GraphQL seja interceptada
    if (url && /graphql/i.test(url)) {
      let requestBody = null;
      const oldXHRSend = this.send;

      // Intercepta o envio da requisição para capturar o corpo da requisição
      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para capturar a resposta quando ela for carregada
      this.addEventListener('load', function () {
        setTimeout(() => {
          try {
            // Verifica múltiplas possíveis consultas no corpo da requisição
            if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
              const responseText = this.responseText;

              // Verifica se o payload da resposta não está vazio
              if (!responseText || typeof responseText !== 'string') {
                console.warn('Resposta vazia ou inválida:', responseText);
                return;
              }

              // Tenta processar as linhas da resposta
              const lines = responseText.split('\n').filter(line => line.trim());

              // Processa no máximo 3 postagens de cada vez, se o número de postagens não ultrapassar o limite
              if (lines.length >= 3 && processedPosts < maxPosts) {
                lines.slice(0, 3).forEach((line, index) => {
                  try {
                    const postData = JSON.parse(line);

                    // Usando deepFind para capturar dados mesmo que a estrutura mude
                    const postText = deepFind(postData, 'postText') || 'Texto não encontrado';
                    const postAuthor = deepFind(postData, 'postAuthor') || 'Autor desconhecido';
                    const postAuthorId = deepFind(postData, 'postAuthorId') || 'ID desconhecido';

                    // Captura e processa dados
                    const parsedData = {
                      post: {
                        text: postText,
                        author: postAuthor,
                        authorId: postAuthorId
                      }
                    };

                    allContent.push(parsedData.post);
                    addCommentsToAllContent(parsedData.topLevelComments);
                    processedPosts++;
                  } catch (error) {
                    console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                  }
                });
              }
            } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
              let data;
              try {
                data = JSON.parse(this.responseText);
              } catch (error) {
                console.error('Erro ao analisar JSON da resposta:', error);
                return;
              }

              // Verifica se os dados contêm as informações esperadas
              if (data?.data && processedPosts < maxPosts) {
                const postId = data.data.story_card?.post_id;
                const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                  ?.comment_rendering_instance_for_feed_location?.comments?.edges;

                if (Array.isArray(comments)) {
                  const formattedComments = comments.map(blah => {
                    const comment = blah.node;
                    return {
                      id: comment?.id,
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

            // Fallback: tenta outra abordagem para processar a resposta
            try {
              const fallbackData = this.responseText;
              if (fallbackData) {
                console.log('Fallback: Dados capturados com sucesso.', fallbackData);
              }
            } catch (fallbackError) {
              console.error('Erro no fallback para a resposta:', fallbackError);
            }
          }
        }, 1000); // 1 segundo de atraso para garantir que os dados estejam carregados
      });
    }

    oldXHROpen.apply(this, arguments);
  };

  // Adiciona um MutationObserver para capturar mudanças no DOM (fallback para capturar novos posts/comentários)
  const observer = new MutationObserver(function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Captura e processa o novo conteúdo adicionado ao DOM
            console.log('Novo conteúdo detectado:', node);
            // Aqui você pode adicionar lógica adicional para processar esse conteúdo
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Função para busca profunda em objetos para capturar dados em qualquer parte da estrutura
function deepFind(obj, key) {
  if (obj.hasOwnProperty(key)) {
    return obj[key];
  }
  for (let i = 0; i < Object.keys(obj).length; i++) {
    let value = obj[Object.keys(obj)[i]];
    if (typeof value === "object" && value !== null) {
      let found = deepFind(value, key);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/*function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    // Expressão regular para garantir que toda requisição GraphQL seja interceptada
    if (url && /graphql/i.test(url)) {
      let requestBody = null;
      const oldXHRSend = this.send;

      // Intercepta o envio da requisição para capturar o corpo da requisição
      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para capturar a resposta quando ela for carregada
      this.addEventListener('load', function () {
        setTimeout(() => {
          try {
            // Verifica múltiplas possíveis consultas no corpo da requisição
            if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
              const responseText = this.responseText;

              // Verifica se o payload da resposta não está vazio
              if (!responseText || typeof responseText !== 'string') {
                console.warn('Resposta vazia ou inválida:', responseText);
                return;
              }

              // Tenta processar as linhas da resposta
              const lines = responseText.split('\n').filter(line => line.trim());

              // Processa no máximo 3 postagens de cada vez, se o número de postagens não ultrapassar o limite
              if (lines.length >= 3 && processedPosts < maxPosts) {
                lines.slice(0, 3).forEach((line, index) => {
                  try {
                    const postData = JSON.parse(line);
                    const parsedData = parsePostData(postData);
                    allContent.push(parsedData.post);
                    addCommentsToAllContent(parsedData.topLevelComments);
                    processedPosts++;
                  } catch (error) {
                    console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                  }
                });
              }
            } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
              let data;
              try {
                data = JSON.parse(this.responseText);
              } catch (error) {
                console.error('Erro ao analisar JSON da resposta:', error);
                return;
              }

              // Verifica se os dados contêm as informações esperadas
              if (data?.data && processedPosts < maxPosts) {
                const postId = data.data.story_card?.post_id;
                const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                  ?.comment_rendering_instance_for_feed_location?.comments?.edges;

                if (Array.isArray(comments)) {
                  const formattedComments = comments.map(blah => {
                    const comment = blah.node;
                    return {
                      id: comment?.id,
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

            // Fallback: tenta outra abordagem para processar a resposta
            try {
              const fallbackData = this.responseText;
              if (fallbackData) {
                console.log('Fallback: Dados capturados com sucesso.', fallbackData);
              }
            } catch (fallbackError) {
              console.error('Erro no fallback para a resposta:', fallbackError);
            }
          }
        }, 1000); // 1 segundo de atraso para garantir que os dados estejam carregados
      });
    }

    oldXHROpen.apply(this, arguments);
  };

  // Adiciona um MutationObserver para capturar mudanças no DOM (fallback para capturar novos posts/comentários)
  const observer = new MutationObserver(function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Captura e processa o novo conteúdo adicionado ao DOM
            console.log('Novo conteúdo detectado:', node);
            // Aqui você pode adicionar lógica adicional para processar esse conteúdo
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
*/

/*
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (url && /graphql/i.test(url)) {
      let requestBody = null;
      const oldXHRSend = this.send;

      // Intercepta o envio da requisição para capturar o corpo da requisição
      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para capturar a resposta quando ela for carregada
      this.addEventListener('load', function () {
        setTimeout(() => {
          try {
            // Verifica se a requisição contém postagens (ex.: FeedQuery ou Pagination)
            if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
              const responseText = this.responseText;

              // Verifica se o payload da resposta não está vazio
              if (!responseText || typeof responseText !== 'string') {
                console.warn('Resposta vazia ou inválida:', responseText);
                return;
              }

              const lines = responseText.split('\n').filter(line => line.trim());

              if (lines.length >= 3 && processedPosts < maxPosts) {
                lines.slice(0, 3).forEach((line, index) => {
                  try {
                    const postData = JSON.parse(line);
                    const parsedData = parsePostData(postData);
                    allContent.push(parsedData.post);
                    addCommentsToAllContent(parsedData.topLevelComments);
                    processedPosts++;
                  } catch (error) {
                    console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                  }
                });
              }
            } 
            // Verifica se a requisição contém comentários (ex.: CometFocusedStoryViewUFIQuery)
            else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
              let data;
              try {
                data = JSON.parse(this.responseText);
              } catch (error) {
                console.error('Erro ao analisar JSON da resposta:', error);
                return;
              }

              // Verifica se os dados contêm as informações esperadas
              if (data?.data && processedPosts < maxPosts) {
                const postId = data.data.story_card?.post_id;
                const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                  ?.comment_rendering_instance_for_feed_location?.comments?.edges;

                if (Array.isArray(comments)) {
                  const formattedComments = comments.map(blah => {
                    const comment = blah.node;
                    return {
                      id: comment?.id,
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
        }, 1000); // 1 segundo de atraso para garantir que os dados estejam carregados
      });
    }

    oldXHROpen.apply(this, arguments);
  };
}
*/

/*
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
*/
/*
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
*/
/*
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    // Expressão regular para garantir que toda requisição GraphQL seja interceptada
    if (url && /graphql/i.test(url)) {
      let requestBody = null;
      const oldXHRSend = this.send;

      // Intercepta o envio da requisição para capturar o corpo da requisição
      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para capturar a resposta quando ela for carregada
      this.addEventListener('load', function () {
        setTimeout(() => {
          try {
            // Verifica múltiplas possíveis consultas no corpo da requisição
            if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
              const responseText = this.responseText;

              // Verifica se o payload da resposta não está vazio
              if (!responseText || typeof responseText !== 'string') {
                console.warn('Resposta vazia ou inválida:', responseText);
                return;
              }

              // Tenta processar as linhas da resposta
              const lines = responseText.split('\n').filter(line => line.trim());

              // Processa no máximo 3 postagens de cada vez, se o número de postagens não ultrapassar o limite
              if (lines.length >= 3 && processedPosts < maxPosts) {
                lines.slice(0, 3).forEach((line, index) => {
                  try {
                    const postData = JSON.parse(line);
                    const parsedData = parsePostData(postData);
                    allContent.push(parsedData.post);
                    addCommentsToAllContent(parsedData.topLevelComments);
                    processedPosts++;
                  } catch (error) {
                    console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                  }
                });
              }
            } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
              let data;
              try {
                data = JSON.parse(this.responseText);
              } catch (error) {
                console.error('Erro ao analisar JSON da resposta:', error);
                return;
              }

              // Verifica se os dados contêm as informações esperadas
              if (data?.data && processedPosts < maxPosts) {
                const postId = data.data.story_card?.post_id;
                const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                  ?.comment_rendering_instance_for_feed_location?.comments?.edges;

                if (Array.isArray(comments)) {
                  const formattedComments = comments.map(blah => {
                    const comment = blah.node;
                    return {
                      id: comment?.id,
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

            // Fallback: tenta outra abordagem para processar a resposta
            try {
              const fallbackData = this.responseText;
              if (fallbackData) {
                console.log('Fallback: Dados capturados com sucesso.', fallbackData);
              }
            } catch (fallbackError) {
              console.error('Erro no fallback para a resposta:', fallbackError);
            }
          }
        }, 1000); // 1 segundo de atraso para garantir que os dados estejam carregados
      });
    }

    oldXHROpen.apply(this, arguments);
  };

  // Adiciona um MutationObserver para capturar mudanças no DOM (fallback para capturar novos posts/comentários)
  const observer = new MutationObserver(function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            // Captura e processa o novo conteúdo adicionado ao DOM
            //console.log('Novo conteúdo detectado:', node);
            // Aqui você pode adicionar lógica adicional para processar esse conteúdo
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
*/
/*function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (url && url.includes('graphql')) {
      let requestBody = null;
      const oldXHRSend = this.send;

      // Intercepta o envio da requisição para capturar o corpo da requisição
      this.send = function (data) {
        requestBody = data;
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para capturar a resposta quando ela for carregada
      this.addEventListener('load', function () {
        try {
          // Verifica se o corpo da requisição contém o identificador esperado
          if (requestBody && requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
            const responseText = this.responseText;

            // Verifica se o payload da resposta não está vazio
            if (!responseText || typeof responseText !== 'string') {
              console.warn('Resposta vazia ou inválida');
              return;
            }

            // Tenta processar as linhas da resposta
            const lines = responseText.split('\n').filter(line => line.trim());

            // Processa no máximo 3 postagens de cada vez, se o número de postagens não ultrapassar o limite
            if (lines.length >= 3 && processedPosts < maxPosts) {
              lines.slice(0, 3).forEach((line, index) => {
                try {
                  const postData = JSON.parse(line);
                  const parsedData = parsePostData(postData);
                  allContent.push(parsedData.post);
                  addCommentsToAllContent(parsedData.topLevelComments);
                  processedPosts++;
                } catch (error) {
                  console.error(`Erro ao processar a postagem ${index + 1}:`, error);
                }
              });
            }
          } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
            let data;
            try {
              data = JSON.parse(this.responseText);
            } catch (error) {
              console.error('Erro ao analisar JSON da resposta:', error);
              return;
            }

            // Verifica se os dados contêm as informações esperadas
            if (data?.data && processedPosts < maxPosts) {
              const postId = data.data.story_card?.post_id;
              const comments = data.data.feedback?.ufi_renderer?.feedback?.comment_list_renderer?.feedback
                ?.comment_rendering_instance_for_feed_location?.comments?.edges;

              if (Array.isArray(comments)) {
                const formattedComments = comments.map(blah => {
                  const comment = blah.node;
                  return {
                    id: comment?.id,
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
      });
    }

    // Chama o método original open
    return oldXHROpen.apply(this, arguments);
  };
}
*/
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
