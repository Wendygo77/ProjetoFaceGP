const allContent = []; // Array para armazenar todas as postagens e comentários coletados.
const commentIds = new Set(); // Define um conjunto para armazenar IDs únicos.

// Função para criar um arquivo CSV a partir dos dados coletados.
function createCSV(data, fileName) {
  const headers = [
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl',
  ];

  const csvContent = [
    headers.join(','), // Junta os cabeçalhos como a primeira linha do CSV.
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null) return 'null'; // Substitui valores nulos por 'null'.
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`; // Escapa as aspas duplas em strings.
        }
        return value;
      }).join(',')
    ),
  ].join('\n'); // Junta todas as linhas para formar o conteúdo CSV.

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, fileName); // Para navegadores como IE10.
  } else {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName || 'data.csv'); // Define o nome do arquivo.
    document.body.appendChild(link);
    link.click(); // Inicia o download.
    document.body.removeChild(link); // Remove o link temporário após o download.
    URL.revokeObjectURL(url); // Libera a memória associada ao objeto URL.
  }
}

// Função para rolar a página automaticamente.
async function scrollDown() {
  const wrapper = window; // Referência à janela de rolagem.
  
  await new Promise(resolve => {
    const distance = 800; // A quantidade de pixels para rolar a cada vez.
    
    const timer = setInterval(() => {
      wrapper.scrollBy(0, distance); // Rola a página para baixo.

      if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
        clearInterval(timer); // Para o intervalo.
        resolve(); // Resolve a promessa após atingir o final da página.
      }
    }, 400); // Espera 400ms entre as rolagens.
  });

  await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa adicional de 1 segundo.
}

// Extrai e retorna o primeiro email encontrado em um texto usando regex.
function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || ''; // Retorna o email ou uma string vazia.
}

// Tenta encontrar e clicar no botão para abrir comentários de uma postagem.
function clickOnComments(post) {
  const allDivs = post.getElementsByTagName('div');
  for (let i = 0; i < allDivs.length; i++) {
    if (allDivs[i].getAttribute('data-visualcompletion') === 'ignore-dynamic') {
      const thingToClickToOpenComments =
        allDivs[i]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]
          ?.children?.[0]?.children?.[1]?.children?.[1]?.children?.[0]
          ?.children?.[0];
      if (thingToClickToOpenComments) {
        thingToClickToOpenComments.click(); // Clica no botão de comentários.
      }
    }
  }
}

// Percorre recursivamente os nós de um elemento e retorna todo o texto contido.
function traverseElementsToGetText(element) {
  let textArray = [];
  if (element.childNodes.length > 0) {
    for (let i = 0; i < element.childNodes.length; i++) {
      textArray = textArray.concat(traverseElementsToGetText(element.childNodes[i]));
    }
  } else if (element.nodeType === Node.TEXT_NODE && element.nodeValue.trim() !== '') {
    textArray.push(element.nodeValue.trim()); // Adiciona o texto ao array se for um nó de texto.
  }
  return textArray;
}

// Função para obter todas as postagens visíveis no feed
function getAllPosts() {
  const posts = document.querySelectorAll('div[role=feed] > div');
  console.log('Posts encontrados:', posts);
  return [...posts].filter(post =>
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

// Função para processar as postagens (exemplo de processamento)
function processPosts() {
  const posts = getAllPosts();
  console.log('Posts processados:', posts);
}

// Função para observar mudanças no feed
function observeFeedChanges(callback) {
  const feed = document.querySelector('div[role=feed]');
  
  if (!feed) {
    console.warn('Feed não encontrado.');
    return;
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        callback();
      }
    });
  });

  observer.observe(feed, { childList: true, subtree: true });

  // Retorna o observador para possível desconexão futura.
  return observer;
}

// Função para configurar o intervalo de verificação
function periodicallyFetchPosts(interval = 10000) {
  setInterval(() => {
    processPosts();
  }, interval); // Intervalo em milissegundos (10000ms = 10 segundos).
}

// Função para lidar com eventos de rolagem
function handleScrollEvents() {
  window.addEventListener('scroll', () => {
    processPosts();
  });
}

// Função para adicionar comentários ao array `allContent`, evitando duplicatas.
function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (c.commentId && !commentIds.has(c.commentId)) {
      commentIds.add(c.commentId); // Adiciona o ID ao conjunto.
      allContent.push(c); // Adiciona o comentário ao array.
    }
  });
}

// Função para interceptar as requisições
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (url && url.includes('graphql')) { // Adiciona uma verificação para garantir que url não seja null
      let requestBody = null;
      const oldXHRSend = this.send;

      this.send = function (data) {
        requestBody = data; // Armazena o corpo da requisição
        oldXHRSend.apply(this, arguments);
      };

      this.addEventListener('load', function () {
        if (requestBody && requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
          const payload = this.responseText;
          const lines = payload.split('\n');

          if (lines.length >= 3) {
            const firstPost = parsePostData(JSON.parse(lines[0]));
            allContent.push(firstPost.post);
            addCommentsToAllContent(firstPost.topLevelComments);

            const secondPost = parsePostData(JSON.parse(lines[1]));
            allContent.push(secondPost.post);
            addCommentsToAllContent(secondPost.topLevelComments);

            const thirdPost = parsePostData(JSON.parse(lines[2]));
            allContent.push(thirdPost.post);
            addCommentsToAllContent(thirdPost.topLevelComments);
          }
        } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) {
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
                  text: commentText,
                  authorName: authorName,
                  authorId: authorId,
                  authorUrl: authorUrl,
                  timestamp: timestamp,
                  commentUrl: commentUrl,
                };
              }) || [];

            addCommentsToAllContent(comments);
          }
        }
      });
    }
    oldXHROpen.apply(this, arguments);
  };
}

// Função principal que combina todas as abordagens
async function main() {
  interceptRequests(); // Inicia a interceptação das requisições.
  console.log('starting...');
  
  let posts = getAllPosts(); // Obtém as postagens visíveis na página.
  let i = 0;

  while (i < posts.length) {
    const post = posts[i];
    clickOnComments(post); // Clica nos comentários da postagem.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo.
    closeDialog(); // Fecha qualquer pop-up.

    i++;
    if (scrolls > 0) {
      await scrollDown(); // Rola a página para baixo para carregar mais postagens.
      scrolls--;
      const currentPosts = getAllPosts(); // Obtém as postagens atualizadas.
      posts = currentPosts;
    }
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv'); // Cria e baixa o arquivo CSV.
  console.log('done!');
}

let scrolls = 1; // Define o número de rolagens que serão feitas.
await main(); // Executa a função principal.
