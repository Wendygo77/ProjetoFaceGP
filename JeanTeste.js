const allContent = []; // Array global para armazenar todos os posts e comentários coletados.

function createCSV(data, fileName = 'data.csv') {
  // Função para gerar um arquivo CSV com os dados de posts e comentários.
  
  const headers = [ // Definindo as colunas do CSV.
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl'
  ];

  const csvContent = [ // Criando o conteúdo do CSV.
    headers.join(','), // Unindo os headers com vírgula.
    ...data.map(row => // Mapeando cada linha de dados.
      headers.map(header => { // Para cada header, pega o valor correspondente.
        const value = row[header]; 
        return `"${(value || 'null').toString().replace(/"/g, '""')}"`; // Substitui aspas duplas e insere valor no formato CSV.
      }).join(',') // Junta cada linha com vírgula.
    )
  ].join('\n'); // Junta todas as linhas com uma nova linha.

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); // Cria um arquivo do tipo CSV.
  const link = document.createElement('a'); // Cria um link para download do CSV.
  link.href = URL.createObjectURL(blob); // Cria uma URL temporária para o arquivo CSV.
  link.download = fileName; // Define o nome do arquivo para download.
  document.body.appendChild(link); // Adiciona o link ao corpo do documento.
  link.click(); // Simula um clique no link para iniciar o download.
  document.body.removeChild(link); // Remove o link após o download.
}

async function scrollDown() {
  // Função para rolar a página para baixo automaticamente.
  window.scrollBy(0, 800); // Rola a página 800 pixels para baixo.
  await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo antes de continuar.
}

function getEmailFromText(text) {
  // Função para extrair emails de um texto.
  return (text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || ''; // Retorna o primeiro e-mail encontrado ou uma string vazia.
}

function clickOnComments(post) {
  // Função que simula o clique para abrir comentários de um post.
  const element = post.querySelector('[data-visualcompletion="ignore-dynamic"]'); // Encontra o elemento que ignora a dinâmica visual.
  element?.querySelectorAll('div')[7]?.click(); // Simula um clique para abrir os comentários se o elemento for encontrado.
}

function traverseElementsToGetText(element) {
  // Função recursiva para pegar todo o texto de um elemento HTML.
  return [...element.childNodes].reduce((acc, node) => { // Para cada nó filho do elemento...
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) acc.push(node.nodeValue.trim()); // Se for um texto, adiciona ao array.
    return acc.concat(traverseElementsToGetText(node)); // Chama a função recursivamente para processar nós filhos.
  }, []); // Retorna o array com os textos encontrados.
}

function getAllPosts() {
  // Seleciona todos os posts que contenham um elemento <h2>, <h3> ou <span> (para nomes de autores)
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => 
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}

function formatTopLevelComments(postId, topLevelComments = []) {
  // Função para formatar os comentários de nível superior de um post.
  return topLevelComments.map(c => { // Mapeia os comentários e extrai as informações necessárias.
    const { id: commentId, body: { text }, author: { name, id } } = c?.comment || {}; // Extrai dados do comentário.
    return {
      id: commentId, commentId, postId, commentText: text || '', commentAuthorName: name,
      commentAuthorId: id, email: getEmailFromText(text), firstName: name?.split(' ')[0], lastName: name?.split(' ')[1]
    }; // Retorna um objeto formatado com os dados do comentário.
  });
}


function parsePostData(json, level = 1) {
  
    // Função para extrair dados de um post em diferentes níveis (primeiro, segundo ou terceiro nível).
  
  const actor = json?.data?.node?.[`comet_sections${level > 1 ? '.content' : ''}`]?.story?.comet_sections?.actor_photo?.story?.actors?.[0]; // Extrai o autor do post.
  
  const { text: postText } = json?.data?.node?.comet_sections?.content?.story?.comet_sections?.message_container?.story?.message || {}; // Extrai o texto do post.
  
  const postId = json?.data?.node?.comet_sections?.feedback?.story?.post_id; // Extrai o ID do post.
  
  const post = { // Cria um objeto post com os dados extraídos.
    id: postId, postId, postText: postText || '', postAuthor: actor?.name, postAuthorId: actor?.id,
    postAuthorUrl: actor?.url, email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0], lastName: actor?.name?.split(' ')?.[1]
  };

  const topLevelComments = formatTopLevelComments(postId, json?.data?.node?.comet_sections?.feedback?.story?.feedback_context?.interesting_top_level_comments); // Formata os comentários de nível superior.
  
  return { post, topLevelComments }; // Retorna o post e os comentários.
}

function addCommentsToAllContent(comments = []) {
  
    // Função para adicionar comentários ao array global `allContent`, evitando duplicatas.
  comments.forEach(c => {
    
    if (!allContent.some(f => f.commentId === c.commentId)) allContent.push(c); // Adiciona o comentário apenas se ele não estiver presente.
  });
}

function interceptRequests() {
  // Função que intercepta as requisições de rede (GraphQL) para capturar dados.
  const oldXHROpen = window.XMLHttpRequest.prototype.open; // Armazena a função original `open` do XMLHttpRequest.
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (!url.includes('graphql')) return oldXHROpen.apply(this, arguments); // Continua a execução normal se não for uma requisição GraphQL.
    const oldXHRSend = this.send;

    this.send = function (data) {
      oldXHRSend.apply(this, arguments);
      this.addEventListener('load', function () { // Quando a requisição carregar...
        const responseData = JSON.parse(this.responseText); // Converte a resposta JSON.
        const { post, topLevelComments } = parsePostData(responseData); // Extrai os dados do post e comentários.
        allContent.push(post); // Adiciona o post ao array global.
        addCommentsToAllContent(topLevelComments); // Adiciona os comentários ao array global.
      });
    };
    return oldXHROpen.apply(this, arguments); // Executa a função `open` original.
  };
}

async function run() {
  // Função principal que executa a captura de dados.
  interceptRequests(); // Intercepta as requisições de rede.
  let posts = getAllPosts(), i = 0; // Pega todos os posts e inicializa o contador.

  while (i < posts.length) { // Enquanto houver posts...
    clickOnComments(posts[i]); // Simula o clique para abrir os comentários.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo.
    i++;
    await scrollDown(); // Rola a página para baixo.
    posts = getAllPosts(); // Atualiza a lista de posts.
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv'); // Cria o arquivo CSV com os dados coletados.
}

let scrolls = 10; // Número de vezes que a página vai rolar.
run(); // Executa a função principal.
