const allContent = []; // Array para armazenar todas as postagens e comentários coletados.

function createCSV(data, fileName) {
  // Função para criar um arquivo CSV a partir dos dados coletados.

  const headers = [
    // Definição dos cabeçalhos (colunas) para o arquivo CSV.
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl',
  ];

  const csvContent = [
    headers.join(','), // Junta os cabeçalhos como a primeira linha do CSV.
    ...data.map(row =>
      // Para cada linha de dados, cria uma string CSV.
      headers.map(header => {
        const value = row[header];
        if (value === null) return 'null'; // Substitui valores nulos por 'null'.
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`; // Escapa as aspas duplas em strings.
        }
        return value;
      }).join(','),
    ),
  ].join('\n'); // Junta todas as linhas para formar o conteúdo CSV.

  // Cria o arquivo CSV como um blob.
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

async function scrollDown() {
  // Função para rolar a página automaticamente.
  const wrapper = window;  // Referência à janela de rolagem.
  
  await new Promise(resolve => {
    const distance = 800; // A quantidade de pixels para rolar a cada vez.
    
    const timer = setInterval(() => {
      wrapper.scrollBy(0, distance); // Rola a página para baixo.

      if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight) {
        // Verifica se chegou ao final da página.
        clearInterval(timer); // Para o intervalo.
        resolve(); // Resolve a promessa após atingir o final da página.
      }
    }, 400); // Espera 400ms entre as rolagens.
  });

  await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa adicional de 1 segundo.
}

function getEmailFromText(text) {
  // Extrai e retorna o primeiro email encontrado em um texto usando regex.
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || ''; // Retorna o email ou uma string vazia.
}

function clickOnComments(post) {
  // Tenta encontrar e clicar no botão para abrir comentários de uma postagem.
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

function traverseElementsToGetText(element) {
  // Percorre recursivamente os nós de um elemento e retorna todo o texto contido.
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

// TESTANDO ESSE SCRIPT
// Função para obter todas as postagens visíveis no feed
function getAllPosts() {
  // Obtém todas as postagens visíveis no feed.
  const posts = document.querySelectorAll('div[role=feed] > div');

  // Filtra as postagens para garantir que contenham pelo menos um dos elementos esperados.
  return [...posts].filter(post =>
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

// Função para processar as postagens (exemplo de processamento)
function processPosts() {
  const posts = getAllPosts();
  console.log('Posts encontrados:', posts);
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

// Função principal que combina todas as abordagens
function main() {
  // Observa mudanças no feed
  observeFeedChanges(processPosts);

  // Configura o intervalo de verificação
  periodicallyFetchPosts();

  // Lida com eventos de rolagem
  handleScrollEvents();
}

// Executa a função principal
main();
console.log(getAllPosts());

// ELA NAO ESTÁ CONSEGUINDO RETORNAR/ENCONTAR OS VALORES DESSA FUNÇÃO
//function getAllPosts() {
  //Obtém todas as postagens visíveis no feed.
  //return [...document.querySelectorAll('div[role=feed] > div')].filter(post =>
 // post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  //);
//}
//function getAllPosts() {
 // const posts = document.querySelectorAll('div[role=feed] > div')
 // return [...posts].filter((post) => {
   // const posterName = post?.querySelector('h3')?.textContent
   // if (posterName) {
   //   return true
    //}
   // return false
  //})
//}
//console.log(getAllPosts());
function closeDialog() {
  // Tenta fechar qualquer diálogo ou pop-up que possa estar aberto.
  const closeButton = document.querySelector('div[aria-label="Close"]');

  if (closeButton) {
    closeButton.click(); // Tenta clicar no botão de fechamento.
  } else {
    // Se o botão não for encontrado, tenta outras abordagens.
    console.warn('Botão de fechamento não encontrado.');
  }
}


// TESTANDO UMA NOVA VERSÃO
function formatTopLevelComments(postId, topLevelComments = []) {
  // Formata os comentários de nível superior (respostas diretas à postagem).
  return topLevelComments.map(c => {
    // Extraí os detalhes do comentário com verificações de segurança.
    const text = c?.comment?.body?.text || ''; // Usa uma string vazia se o texto não estiver disponível.
    const commentId = c?.comment?.id || ''; // Usa uma string vazia se o ID do comentário não estiver disponível.
    const authorName = c?.comment?.author?.name || 'Desconhecido'; // Usa 'Desconhecido' se o nome do autor não estiver disponível.
    const authorId = c?.comment?.author?.id || ''; // Usa uma string vazia se o ID do autor não estiver disponível.

    return {
      id: commentId,
      commentId,
      postId,
      commentText: text,
      commentAuthorName: authorName,
      commentAuthorId: authorId,
      email: getEmailFromText(text), // Extrai o email do texto do comentário.
      firstName: authorName.split(' ')[0] || 'Desconhecido', // Extrai o primeiro nome ou usa 'Desconhecido'.
      lastName: authorName.split(' ')[1] || '', // Extrai o sobrenome ou usa uma string vazia.
    };
  });
}


// TESTANDO ESSA VERSÃO 
function parsePostData(json) {
  // Verifica se o JSON possui a estrutura esperada e extrai o ator (autor) da postagem.
  const actor = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.context_layout?.story?.comet_sections?.actor_photo?.story?.actors?.[0];

  // Verifica se o JSON possui a estrutura esperada e extrai o texto da postagem.
  const postText = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
    ?.story?.comet_sections?.message_container?.story?.message?.text || '';

  // Verifica se o JSON possui a estrutura esperada e extrai o ID da postagem.
  const postId = json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
    ?.story?.post_id || '';

  // Valida se o ator e o texto da postagem foram encontrados, e cria o objeto da postagem.
  const post = {
    id: postId,
    postId,
    postText,
    postAuthor: actor?.name || 'Desconhecido', // Usa 'Desconhecido' se o nome do autor não estiver disponível.
    postAuthorId: actor?.id || '',
    postAuthorUrl: actor?.url || '',
    email: getEmailFromText(postText), // Extrai o email do texto da postagem.
    firstName: actor?.name?.split(' ')?.[0] || 'Desconhecido', // Usa 'Desconhecido' se o primeiro nome não estiver disponível.
    lastName: actor?.name?.split(' ')?.[1] || '', // Usa uma string vazia se o último nome não estiver disponível.
  };

  // Extrai e formata os comentários de nível superior, se disponíveis.
  const topLevelComments = formatTopLevelComments(
    postId,
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.feedback_context?.interesting_top_level_comments || []
  );

  // Retorna o objeto da postagem e os comentários formatados.
  return {
    post,
    topLevelComments,
  };
}


//ESTÁ FUNCIONANDO PERFEITAMENTE
const commentIds = new Set(); // Define um conjunto para armazenar IDs únicos.
function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (c.commentId && !commentIds.has(c.commentId)) {
      commentIds.add(c.commentId); // Adiciona o ID ao conjunto.
      allContent.push(c); // Adiciona o comentário ao array.
    }
  });
}

function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (c.commentId && !commentIds.has(c.commentId)) {
      commentIds.add(c.commentId); // Adiciona o ID ao conjunto.
      allContent.push(c); // Adiciona o comentário ao array.
    }
  });
}

function addCommentsToAllContent(comments = []) {
  // Adiciona novos comentários ao array `allContent`, evitando duplicatas.
  comments.forEach(c => {
    if (!allContent.find(f => f.commentId === c.commentId)) {
      allContent.push(c);
    }
  });
}

//ESTÁ FUNCIONANDO PERFEITAMENTE
function interceptRequests() {
  // Armazena a função original XMLHttpRequest.open
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
  // Substitui a função XMLHttpRequest.open
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    // Verifica se a URL é uma URL GraphQL
    if (url && url.includes('graphql')) { // Adiciona uma verificação para garantir que url não seja null
      let requestBody = null;
      const oldXHRSend = this.send;
      
      // Substitui a função XMLHttpRequest.send
      this.send = function (data) {
        requestBody = data; // Armazena o corpo da requisição
        oldXHRSend.apply(this, arguments);
      };

      // Adiciona um listener para o evento 'load'
      this.addEventListener('load', function () {
        if (requestBody && requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery')) { // Adiciona uma verificação para garantir que requestBody não seja null
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
        } else if (requestBody && requestBody.includes('CometFocusedStoryViewUFIQuery')) { // Adiciona uma verificação para garantir que requestBody não seja null
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
        }
      });
    }
    
    // Chama a função original XMLHttpRequest.open
    return oldXHROpen.apply(this, arguments);
  };
}


// ESTÁ FUNCIONANDO CORRETAMENTE
async function run() {
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
await run(); // Executa a função principal.
