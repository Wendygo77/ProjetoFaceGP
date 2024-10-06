// Configurações para o script
const config = {
  maxPosts: 40, // Número máximo de posts a serem processados
  scrollInterval: 500, // Intervalo entre scrolls em milissegundos
  requestDelay: 1000, // Atraso entre requisições em milissegundos
  maxRetries: 3, // Número máximo de tentativas para operações que podem falhar
  cacheKey: 'fbScraperCache', // Chave para armazenamento em cache local
};

// Objeto para armazenar postagens e comentários, usando Sets para evitar duplicatas
const allContent = {
  posts: new Set(),
  comments: new Set()
};

// Variável para contar quantas postagens foram processadas
let processedPosts = 0;

// Função para criar um arquivo CSV com os dados coletados
function createCSV(data, fileName) {
  // Define os cabeçalhos do CSV
  const headers = [
    'Tipo', 'ID', 'Texto', 'Autor', 'ID do Autor', 'URL do Autor',
    'Email', 'Nome', 'Sobrenome', 'Timestamp', 'URL'
  ];

  // Cria o conteúdo do CSV
  const csvContent = [
    headers.join(','),
    // Mapeia os posts para o formato CSV
    ...[...data.posts].map(post => [
      'Post',
      post.postId,
      post.postText,
      post.postAuthor,
      post.postAuthorId,
      post.postAuthorUrl,
      '', // Email (vazio para posts)
      '', // Nome (vazio para posts)
      '', // Sobrenome (vazio para posts)
      '', // Timestamp (vazio para posts)
      ''  // URL (vazio para posts)
    ].map(value => `"${(value || '').replace(/"/g, '""')}"`).join(',')),
    // Mapeia os comentários para o formato CSV
    ...[...data.comments].map(comment => [
      'Comentário',
      comment.commentId,
      comment.commentText,
      comment.commentAuthorName,
      comment.commentAuthorId,
      comment.commentAuthorUrl,
      comment.email,
      comment.firstName,
      comment.lastName,
      comment.timestamp,
      comment.commentUrl
    ].map(value => `"${(value || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Cria um Blob com o conteúdo CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  // Verifica se o navegador é o IE para salvar o arquivo
  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, fileName);
  } else {
    // Para outros navegadores, cria um link temporário e simula o clique
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', fileName || 'data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // Loga uma mensagem de sucesso
  console.log('CSV criado com sucesso. Estrutura melhorada para visualização.');
}

// O resto do código permanece o mesmo...

// Função para extrair um email de um texto
function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || '';
}

// Função para clicar no botão de expandir comentários
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
        console.log('Comentários expandidos com sucesso');
        return true;
      }
    }
  }
  console.warn('Botão de comentários não encontrado');
  return false;
}

// Função para obter todos os posts da página
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
    
    // Adiciona o post ao conjunto de posts
    allContent.posts.add(postData);
    return post;
  });
}

// Função para adicionar comentários ao objeto allContent
function addCommentsToAllContent(comments = [], postId) {
  comments.forEach(c => {
    c.postId = postId; // Adiciona o postId ao comentário
    allContent.comments.add(c);
  });
  console.log(`Adicionados ${comments.length} comentários para o post ${postId}`);
}

// Função para interceptar requisições e processar dados
function interceptRequests() {
    // Salva a função original de open do XMLHttpRequest
    const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
    // Sobrescreve a função open do XMLHttpRequest
    window.XMLHttpRequest.prototype.open = function (method, url, async) {
      // Intercepta requisições GraphQL
      if (url && /graphql/i.test(url)) {
        let requestBody = null;
        const oldXHRSend = this.send;
  
        // Sobrescreve a função send do XMLHttpRequest
        this.send = function (data) {
          requestBody = data;
          oldXHRSend.apply(this, arguments);
        };
  
        // Adiciona um listener para o evento 'load'
        this.addEventListener('load', function () {
          setTimeout(() => {
            try {
              const responseText = this.responseText;
  
              // Verifica se o payload da resposta não está vazio
              if (!responseText || typeof responseText !== 'string') {
                console.warn('Resposta vazia ou inválida:', responseText);
                return;
              }
  
              // Processa a resposta
              const lines = responseText.split('\n').filter(line => line.trim());
  
              // Processa múltiplas consultas no corpo da requisição
              if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
                if (lines.length >= 3 && processedPosts < config.maxPosts) {
                  lines.slice(0, 3).forEach((line, index) => {
                    try {
                      const postData = JSON.parse(line);
                      const postText = deepFind(postData, 'postText') || 'Texto não encontrado';
                      const postAuthor = deepFind(postData, 'postAuthor') || 'Autor desconhecido';
                      const postAuthorId = deepFind(postData, 'postAuthorId') || 'ID desconhecido';
  
                      const parsedData = {
                        post: {
                          text: postText,
                          author: postAuthor,
                          authorId: postAuthorId
                        }
                      };
  
                      allContent.posts.add(parsedData.post);
                      processedPosts++;
                      console.log(`Processada postagem ${processedPosts}: ${postAuthor}`);
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
  
                if (data?.data && processedPosts < config.maxPosts) {
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
                        commentText: comment?.body?.text || ' Texto não disponível',
                        commentAuthorName: comment?.author?.name || 'Autor desconhecido',
                        commentAuthorId: comment?.author?.id || '',
                        commentAuthorUrl: comment?.author?.url || '',
                        email: getEmailFromText(comment?.body?.text),
                        firstName: comment?.author?.name?.split(' ')?.[0] || 'Desconhecido',
                        lastName: comment?.author?.name?.split(' ')?.[1] || '',
                      };
                    });
                    addCommentsToAllContent(formattedComments, postId);
                    processedPosts++;
                  } else {
                    console.warn('Comentários não disponíveis ou em formato inesperado para o post', postId);
                  }
                }
              }
            } catch (error) {
              console.error('Erro ao interceptar a requisição:', error);
            }
          }, 1000);
        });
      }
  
      // Chama a função original de open
      oldXHROpen.apply(this, arguments);
    };
  
    // Adiciona um observador de mutações para detectar mudanças no DOM
    const observer = new MutationObserver(function (mutationsList) {
      for (let mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              console.log('Novo conteúdo detectado:', node.tagName);
            }
          });
        }
      }
    });
  
    // Inicia a observação do DOM
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('Interceptação de requisições e observação do DOM iniciadas');
  }

// Função principal que executa o processo de coleta de dados
async function run() {
  console.log('Iniciando o processo de coleta de dados...');
  interceptRequests();
  
  let posts = getAllPosts();
  let i = 0;

  // Loop principal para processar posts
  while (i < posts.length && processedPosts < config.maxPosts) {
    const post = posts[i];
    console.log(`Processando post ${i + 1} de ${posts.length}`);
    
    // Tenta expandir os comentários do post
    if (clickOnComments(post)) {
      await new Promise(resolve => setTimeout(resolve, config.requestDelay));
      console.log(`Aguardando ${config.requestDelay}ms para carregar comentários`);
    }

    i++;
    
    // Realiza scroll para carregar mais posts
    window.scrollTo(0, document.body.scrollHeight);
    console.log('Realizando scroll para carregar mais conteúdo');
    await new Promise(resolve => setTimeout(resolve, config.scrollInterval));
    
    // Atualiza a lista de posts
    posts = getAllPosts();
  }

  // Gera o arquivo CSV com os dados coletados
  console.log('Gerando arquivo CSV...');
  createCSV(allContent, 'facebookGroupPostsAndComments.csv');
  console.log('Processo concluído! Arquivo CSV gerado com sucesso.');
}

// Execute a função principal
run();