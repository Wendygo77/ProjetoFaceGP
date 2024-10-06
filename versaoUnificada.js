// Configurações
const config = {
  maxPosts: 40,
  scrollInterval: 500,
  requestDelay: 1000,
  maxRetries: 3,
  cacheKey: 'fbScraperCache',
};

const allContent = {
  posts: new Set(),
  comments: new Set()
};

let processedPosts = 0;

// Função para salvar progresso no localStorage
function saveProgress() {
  localStorage.setItem(config.cacheKey, JSON.stringify({
    posts: Array.from(allContent.posts),
    comments: Array.from(allContent.comments),
    processedPosts
  }));
  console.log('Progresso salvo no localStorage.');
}

// Função para carregar progresso salvo
function loadProgress() {
  const savedData = localStorage.getItem(config.cacheKey);
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    allContent.posts = new Set(parsedData.posts);
    allContent.comments = new Set(parsedData.comments);
    processedPosts = parsedData.processedPosts;
    console.log('Progresso carregado do localStorage.');
  }
}

// Função para criar CSV
function createCSV(data, fileName) {
  const headers = [
    'Tipo', 'ID', 'Texto', 'Autor', 'ID do Autor', 'URL do Autor',
    'Email', 'Nome', 'Sobrenome', 'Timestamp', 'URL'
  ];

  const csvContent = [
    headers.join(','),
    ...[...data.posts].map(post => formatCSVRow('Post', post)),
    ...[...data.comments].map(comment => formatCSVRow('Comentário', comment))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, fileName);
  
  console.log('CSV criado com sucesso. Estrutura melhorada para visualização.');
}

function formatCSVRow(type, item) {
  const rowData = type === 'Post' 
    ? [type, item.postId, item.postText, item.postAuthor, item.postAuthorId, item.postAuthorUrl, '', '', '', item.timestamp, '']
    : [type, item.commentId, item.commentText, item.commentAuthorName, item.commentAuthorId, item.commentAuthorUrl, item.email, item.firstName, item.lastName, item.timestamp, item.commentUrl];
  
  return rowData.map(value => `"${(value || '').replace(/"/g, '""')}"`).join(',');
}

function downloadFile(blob, fileName) {
  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, fileName);
  } else {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName || 'data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Função para detectar emails
const getEmailFromText = text => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return (text?.match(emailRegex)?.[0]) || '';
};

// Função para clicar nos comentários
const clickOnComments = post => {
  const commentButton = post.querySelector('div[data-visualcompletion="ignore-dynamic"] div[role="button"]');
  if (commentButton) {
    commentButton.click();
    console.log('Comentários expandidos com sucesso');
    return true;
  }
  console.warn('Botão de comentários não encontrado');
  return false;
}

// Função para observar mudanças no DOM (carregamento de novos comentários)
const observeDOMChanges = (post, callback) => {
  return new Promise((resolve) => {
    const observer = new MutationObserver(mutations => {
      for (let mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          console.log('Mudança detectada no DOM, checando comentários...');
          callback();
          observer.disconnect();
          resolve();
          return;
        }
      }
    });

    observer.observe(post, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 5000);
  });
};

// Função para obter todos os posts
function getAllPosts() {
  const feedPosts = document.querySelectorAll('div[role="feed"] > div');
  
  const filteredPosts = [...feedPosts].filter(post => {
    const hasAuthorOrTitle = post.querySelector('h2, h3, span');
    const hasContent = post.querySelector('p, div[role="article"], div[dir="auto"]');
    
    return hasAuthorOrTitle && hasContent && post.textContent.trim().length > 0;
  });

  console.log(`Encontrados ${filteredPosts.length} posts válidos`);
  
  return filteredPosts.map(extractPostData);
}

function extractPostData(post) {
  const postTextElements = post.querySelectorAll('div[dir="auto"]');
  const postText = Array.from(postTextElements).map(el => el.textContent).join(' ').trim();
  
  const authorElement = post.querySelector('h2, h3, span');
  const postAuthor = authorElement ? authorElement.textContent : 'Desconhecido';
  
  const postId = post.getAttribute('id') || 'id-desconhecido';
  
  const postData = {
    postId,
    postText,
    postAuthor,
    postAuthorId: '', // ID do autor pode ser adicionado, se disponível
    postAuthorUrl: '', // URL do perfil do autor, se disponível
    timestamp: post.querySelector('abbr')?.getAttribute('data-utime') || '',
  };
  
  if (!Array.from(allContent.posts).some(existingPost => existingPost.postId === postData.postId)) {
    allContent.posts.add(postData);
  }
  return post;
}

// Função para extrair comentários
function extractComments(post) {
  const commentElements = post.querySelectorAll('div[aria-label="Comentário"]');
  return Array.from(commentElements).map(extractCommentData);
}

function extractCommentData(commentElement) {
  const commentId = commentElement.id || `comment-${Date.now()}`;
  const commentText = commentElement.querySelector('div[dir="auto"]')?.textContent || '';
  const authorElement = commentElement.querySelector('a[role="link"]');
  const commentAuthorName = authorElement?.textContent || 'Desconhecido';
  const commentAuthorId = authorElement?.href?.match(/\/(\d+)/)?.[1] || '';
  const commentAuthorUrl = authorElement?.href || '';
  const timestamp = commentElement.querySelector('abbr')?.getAttribute('data-utime') || '';
  const commentUrl = commentElement.querySelector('a[href*="comment_id"]')?.href || '';

  const email = getEmailFromText(commentText);
  const [firstName, ...lastNameParts] = commentAuthorName.split(' ');
  const lastName = lastNameParts.join(' ');

  return {
    commentId,
    commentText,
    commentAuthorName,
    commentAuthorId,
    commentAuthorUrl,
    email,
    firstName,
    lastName,
    timestamp,
    commentUrl
  };
}

// Adiciona comentários ao conteúdo
const addCommentsToAllContent = (comments = [], postId) => {
  comments.forEach(c => {
    c.postId = postId;
    if (!Array.from(allContent.comments).some(existingComment => existingComment.commentId === c.commentId)) {
      allContent.comments.add(c);
    }
  });
  console.log(`Adicionados ${comments.length} comentários para o post ${postId}`);
};

// Função para interceptar requisições
const interceptRequests = () => {
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
      if (requestBody?.includes('GroupsCometFeedRegularStoriesPaginationQuery')) {
        console.log('Obtendo posts...');
        const payload = this.responseText;
        const lines = payload.split('\n');

        lines.forEach(line => {
          try {
            const data = JSON.parse(line);
            const postData = extractPostDataFromResponse(data);
            if (postData) {
              allContent.posts.add(postData);
            }
          } catch (e) {
            console.warn('Erro ao processar payload', e);
          }
        });
      }
    });
    oldXHROpen.apply(this, arguments);
  };
};

function extractPostDataFromResponse(data) {
  const postEdge = data?.data?.node?.group_feed?.edges?.[0]?.node;
  if (!postEdge) return null;

  return {
    postId: postEdge?.comet_sections?.feedback?.story?.post_id || 'ID desconhecido',
    postText: postEdge?.comet_sections?.content?.story?.comet_sections?.message_container?.story?.message?.text || 'Texto não encontrado',
    postAuthor: postEdge?.comet_sections?.content?.story?.comet_sections?.actor_photo?.story?.actors?.[0]?.name || 'Autor desconhecido',
    postAuthorId: postEdge?.comet_sections?.content?.story?.comet_sections?.actor_photo?.story?.actors?.[0]?.id || '',
    postAuthorUrl: postEdge?.comet_sections?.content?.story?.comet_sections?.actor_photo?.story?.actors?.[0]?.url || '',
    timestamp: postEdge?.comet_sections?.feedback?.story?.creation_time || '',
  };
}

// Função principal para iniciar o scraper
async function startScraping() {
  try {
    interceptRequests();
    loadProgress();
    updateUI('Scraping iniciado...');

    let retries = 0;

    while (processedPosts < config.maxPosts && retries < config.maxRetries) {
      const posts = getAllPosts();

      if (posts.length === 0) {
        retries++;
        updateUI(`Tentativa ${retries} de obter posts falhou. Tentando novamente...`);
      } else {
        retries = 0;
        for (let i = processedPosts; i < posts.length && i < config.maxPosts; i++) {
          const post = posts[i];
          if (clickOnComments(post)) {
            await observeDOMChanges(post, () => {
              const comments = extractComments(post);
              addCommentsToAllContent(comments, post.getAttribute('id') || 'ID desconhecido');
            });
          }
          processedPosts++;
          saveProgress();
          updateUI(`Processados ${processedPosts} posts de ${config.maxPosts}`);
          await new Promise(r => setTimeout(r, config.requestDelay));
        }
      }

      window.scrollBy(0, window.innerHeight);
      await new Promise(r => setTimeout(r, config.scrollInterval));
    }

    createCSV(allContent, 'posts_comments.csv');
    updateUI('Scraping concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante o scraping:', error);
    updateUI('Erro durante o scraping. Verifique o console para mais detalhes.');
  }
}

// Interface de usuário básica
function createUI() {
  const uiContainer = document.createElement('div');
  Object.assign(uiContainer.style, {
    position: 'fixed',
    top: '10px',
    right: '10px',
    zIndex: '9999',
    backgroundColor: 'white',
    padding: '10px',
    border: '1px solid black'
  });

  const startButton = document.createElement('button');
  startButton.textContent = 'Iniciar Scraping';
  startButton.onclick = startScraping;

  const statusDiv = document.createElement('div');
  statusDiv.id = 'scrapingStatus';
  statusDiv.textContent = 'Pronto para iniciar';

  uiContainer.appendChild(startButton);
  uiContainer.appendChild(statusDiv);
  document.body.appendChild(uiContainer);
}

createUI();

// Atualizar a interface do usuário com o progresso
function updateUI(message) {
  const statusDiv = document.getElementById('scrapingStatus');
  if (statusDiv) {
    statusDiv.textContent = message;
  }
}
