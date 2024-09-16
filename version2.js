// Array global para armazenar posts e comentários
let allContent = []; 

// Função que intercepta as requisições de rede (GraphQL) para capturar dados.
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open; // Armazena a função original `open` do XMLHttpRequest.
  
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (!url.includes('graphql')) return oldXHROpen.apply(this, arguments); // Continua a execução normal se não for uma requisição GraphQL.
    
    const oldXHRSend = this.send;

    this.send = function (data) {
      oldXHRSend.apply(this, arguments);
      this.addEventListener('load', function () { // Quando a requisição carregar...
        try {
          const responseData = JSON.parse(this.responseText); // Converte a resposta JSON.
          const { post, topLevelComments } = parsePostData(responseData); // Extrai os dados do post e comentários.
          allContent.push(post); // Adiciona o post ao array global.
          addCommentsToAllContent(topLevelComments); // Adiciona os comentários ao array global.
        } catch (error) {
          console.error('Erro ao processar a resposta:', error);
        }
      });
    };
    
    return oldXHROpen.apply(this, arguments); // Executa a função `open` original.
  };
}

// Função para extrair dados do post e comentários da resposta
function parsePostData(responseData) {
  // Ajuste a extração dos dados conforme a estrutura da resposta
  const post = responseData.data.post; // Exemplo de caminho para dados do post
  const topLevelComments = responseData.data.topLevelComments; // Exemplo de caminho para comentários
  return { post, topLevelComments };
}

// Função para adicionar comentários ao array global allContent
function addCommentsToAllContent(comments) {
  comments.forEach(comment => allContent.push(comment));
}

// Função para obter todos os posts na página
function getAllPosts() {
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => 
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

// Função para rolar a página para carregar mais posts
async function scrollDown() {
  return new Promise(resolve => {
    window.scrollTo(0, document.body.scrollHeight);
    setTimeout(() => {
      resolve();
    }, 2000); // Aguarda 2 segundos para garantir que a rolagem é concluída
  });
}

// Função para criar um arquivo CSV a partir do conteúdo coletado
function createCSV(data, filename) {
  const csvContent = data.map(item => {
    // Ajuste o formato do CSV conforme necessário
    return `${item.id},${item.content.replace(/,/g, '')}`; // Exemplo: formata o CSV com id e conteúdo
  }).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Função que clica no botão de comentários de um post, se disponível
function clickOnComments(post) {
  try {
    const element = post.querySelector('[data-visualcompletion="ignore-dynamic"]');
    if (element) {
      const buttons = element.querySelectorAll('div');
      console.log('Número de divs encontradas:', buttons.length); // Log do número de divs encontradas
      if (buttons.length > 7) {
        const commentButton = buttons[7];
        console.log('Botão de comentários encontrado:', commentButton); // Log do botão encontrado
        commentButton.click(); // Tenta clicar no botão
      } else {
        console.error('Número insuficiente de divs para encontrar o botão de comentários.');
      }
    } else {
      console.error('Elemento para expandir comentários não encontrado.');
    }
  } catch (error) {
    console.error('Erro ao tentar clicar no botão de comentários:', error);
  }
}

// Atualize a função para obter todos os posts e processar os comentários
async function run() {
  interceptRequests(); // Inicia a interceptação das requisições
  let posts = getAllPosts();
  let i = 0;

  while (i < posts.length) {
    console.log('Processando post', i + 1, 'de', posts.length); // Log do progresso
    clickOnComments(posts[i]); // Clica para expandir os comentários
    await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2 segundos
    i++;
    await scrollDown(); // Faz o scroll para carregar mais posts
    posts = getAllPosts(); // Atualiza a lista de posts
  }

  console.log('Coleta concluída. Gerando CSV...');
  console.log('Conteúdo coletado:', allContent); // Log do conteúdo final

  // Verifica se coletou algum conteúdo antes de gerar o CSV
  if (allContent.length > 0) {
    createCSV(allContent, 'facebookGroupPostsAndComments.csv'); // Gera o CSV
  } else {
    console.log('Nenhum dado foi coletado.'); // Log se não houver dados
  }
}

// Define o número de scrolls e executa o script principal
let scrolls = 10;
run(); // Executa o script principal
