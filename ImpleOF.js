// Array global que armazenará todos os posts e comentários coletados.
const allContent = []; 

// Função para criar e baixar o CSV
function createCSV(data, fileName = 'data.csv') {
  // Cabeçalhos das colunas do CSV
  const headers = [
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl'
  ];

  // Gera o conteúdo do CSV
  const csvContent = [
    headers.join(','), // Primeira linha do CSV (os cabeçalhos)
    // Para cada linha de dados, gera um valor correspondente a cada coluna
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Trata valores vazios ou nulos, e evita problemas com aspas duplas
        return `"${(value || 'null').toString().replace(/"/g, '""')}"`;
      }).join(',') // Junta cada campo com uma vírgula
    )
  ].join('\n'); // Junta todas as linhas com quebras de linha

  // Cria o arquivo CSV como um Blob e simula o clique para fazer download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click(); // Faz o download do arquivo
  document.body.removeChild(link);
}

// Função que realiza o scroll na página para carregar mais posts
async function scrollDown() {
  window.scrollBy(0, 800); // Rola a página para baixo
  await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo antes de continuar
}

// Função que extrai o e-mail de um texto
function getEmailFromText(text) {
  // Expressão regular que busca por padrões de e-mail no texto
  return (text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || '';
}

// Função que clica no botão de comentários de um post, se disponível
function clickOnComments(post) {
  const element = post.querySelector('[data-visualcompletion="ignore-dynamic"]');
  // Tenta clicar na sétima div dentro do elemento para expandir os comentários
  element?.querySelectorAll('div')[7]?.click();
}

// Função que percorre um elemento HTML recursivamente para obter o texto
function traverseElementsToGetText(element) {
  return [...element.childNodes].reduce((acc, node) => {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) acc.push(node.nodeValue.trim());
    return acc.concat(traverseElementsToGetText(node)); // Recorre para os filhos
  }, []);
}

// Função que seleciona todos os posts no feed
function getAllPosts() {
  // Seleciona todos os posts que contenham um elemento <h3> (geralmente o nome do autor)
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => post.querySelector('h3'));
}

// Função que formata os comentários de um post
function formatTopLevelComments(postId, topLevelComments = []) {
  return topLevelComments.map(c => {
    const { id: commentId, body: { text }, author: { name, id } } = c?.comment || {};
    // Formata os dados do comentário para ser usado no CSV
    return {
      id: commentId || 'null',
      commentId: commentId || 'null',
      postId: postId || 'null',
      commentText: text || 'null',
      commentAuthorName: name || 'null',
      commentAuthorId: id || 'null',
      email: getEmailFromText(text),
      firstName: name?.split(' ')[0] || 'null',
      lastName: name?.split(' ')[1] || 'null',
    };
  });
}

// Função que extrai dados de um post e seus comentários a partir de um JSON
function parseFirstLevelJson(json) {
  // Extrai o autor do post
  const actor =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.context_layout?.story?.comet_sections
      ?.actor_photo?.story?.actors?.[0];

  // Extrai o texto do post
  const postText =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.message_container?.story?.message?.text;
  
  // Extrai o ID do post
  const postId =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.post_id;
    
  // Formata os dados do post
  const post = {
    id: postId || 'null',
    postId: postId || 'null',
    postText: postText || 'null',
    postAuthor: actor?.name || 'null',
    postAuthorId: actor?.id || 'null',
    postAuthorUrl: actor?.url || 'null',
    email: getEmailFromText(postText) || 'null',
    firstName: actor?.name?.split(' ')?.[0] || 'null',
    lastName: actor?.name?.split(' ')?.[1] || 'null',
  };

  // Formata os comentários do post
  const topLevelComments = formatTopLevelComments(
    postId,
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.feedback_context?.interesting_top_level_comments,
  );

  console.log('Post extraído:', post); // Log para ver o post extraído
  console.log('Comentários extraídos:', topLevelComments); // Log para ver os comentários extraídos
  
  return { post, topLevelComments }; // Retorna o post e seus comentários
}

// Função que adiciona comentários ao array allContent, sem duplicar
function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (!allContent.some(f => f.commentId === c.commentId)) allContent.push(c);
  });
}

// Função que intercepta as requisições de rede e coleta os dados
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
  window.XMLHttpRequest.prototype.open = function (method, url) {
    // Intercepta apenas requisições que contêm "graphql"
    if (!url.includes('graphql')) return oldXHROpen.apply(this, arguments);
    
    const oldXHRSend = this.send;
    
    this.send = function (data) {
      oldXHRSend.apply(this, arguments);
      this.addEventListener('load', function () {
        const payload = this.responseText;
        const lines = payload.split('\n');
        try {
          // Tenta interpretar a resposta como JSON
          const responseData = JSON.parse(lines[0]);

          // Extrai o post e os comentários do JSON
          const { post, topLevelComments } = parseFirstLevelJson(responseData);
          allContent.push(post); // Adiciona o post ao array allContent
          addCommentsToAllContent(topLevelComments); // Adiciona os comentários
        } catch (error) {
          console.error('Erro ao processar a resposta JSON:', error); // Loga erros de processamento
        }
      });
    };
    return oldXHROpen.apply(this, arguments);
  };
}

// Função principal que executa o processo
async function run() {
  interceptRequests(); // Inicia a interceptação das requisições
  let posts = getAllPosts(), i = 0;

  // Percorre cada post na página
  while (i < posts.length) {
    console.log('Processando post', i + 1, 'de', posts.length); // Log do progresso
    clickOnComments(posts[i]); // Clica para expandir os comentários
    await new Promise(resolve => setTimeout(resolve, 1000)); // Aguarda 1 segundo
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
