const allContent = []; // Array global para armazenar todos os posts e comentários coletados.

function createCSV(data, fileName = 'data.csv') {
  const headers = [
    'id', 'email', 'firstName', 'lastName', 'postId', 'postText', 'postAuthor',
    'postAuthorId', 'postAuthorUrl', 'commentId', 'commentText', 'commentAuthorName',
    'commentAuthorId', 'commentAuthorUrl', 'timestamp', 'commentUrl'
  ];

  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        return `"${(value || 'null').toString().replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function scrollDown() {
  window.scrollBy(0, 800);
  await new Promise(resolve => setTimeout(resolve, 1000));
}

function getEmailFromText(text) {
  return (text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || '';
}

function clickOnComments(post) {
  const element = post.querySelector('[data-visualcompletion="ignore-dynamic"]');
  element?.querySelectorAll('div')[7]?.click();
}

function traverseElementsToGetText(element) {
  return [...element.childNodes].reduce((acc, node) => {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) acc.push(node.nodeValue.trim());
    return acc.concat(traverseElementsToGetText(node));
  }, []);
}

function getAllPosts() {
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => post.querySelector('h3'));
}

function formatTopLevelComments(postId, topLevelComments = []) {
  return topLevelComments.map(c => {
    const { id: commentId, body: { text }, author: { name, id } } = c?.comment || {};
    return {
      id: commentId, commentId, postId, commentText: text || '', commentAuthorName: name,
      commentAuthorId: id, email: getEmailFromText(text), firstName: name?.split(' ')[0], lastName: name?.split(' ')[1]
    };
  });
}

// Função combinada para extrair dados do post
function parseFirstLevelJson(json) {
  const actor =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.context_layout?.story?.comet_sections
      ?.actor_photo?.story?.actors?.[0];

  const postText =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.content
      ?.story?.comet_sections?.message_container?.story?.message?.text;
  const postId =
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.post_id;
    
  const post = {
    id: postId,
    postId,
    postText: postText || '',
    postAuthor: actor?.name,
    postAuthorId: actor?.id,
    postAuthorUrl: actor?.url,
    email: getEmailFromText(postText),
    firstName: actor?.name?.split(' ')?.[0],
    lastName: actor?.name?.split(' ')?.[1],
  };

  const topLevelComments = formatTopLevelComments(
    postId,
    json?.data?.node?.group_feed?.edges?.[0]?.node?.comet_sections?.feedback
      ?.story?.feedback_context?.interesting_top_level_comments,
  );
  
  return { post, topLevelComments };
}

function addCommentsToAllContent(comments = []) {
  comments.forEach(c => {
    if (!allContent.some(f => f.commentId === c.commentId)) allContent.push(c);
  });
}

// Função de interceptação que combina a extração e captura de requisições
function interceptRequests() {
  const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (!url.includes('graphql')) return oldXHROpen.apply(this, arguments);
    
    const oldXHRSend = this.send;
    
    this.send = function (data) {
      oldXHRSend.apply(this, arguments);
      this.addEventListener('load', function () {
        const payload = this.responseText;
        const lines = payload.split('\n');
        const responseData = JSON.parse(lines[0]);

        const { post, topLevelComments } = parseFirstLevelJson(responseData);
        allContent.push(post);
        addCommentsToAllContent(topLevelComments);
      });
    };
    return oldXHROpen.apply(this, arguments);
  };
}

async function run() {
  interceptRequests(); // Inicia a interceptação das requisições
  let posts = getAllPosts(), i = 0;

  while (i < posts.length) {
    clickOnComments(posts[i]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    i++;
    await scrollDown();
    posts = getAllPosts(); // Atualiza a lista de posts
  }

  createCSV(allContent, 'facebookGroupPostsAndComments.csv'); // Gera o CSV ao final
}

let scrolls = 10;
run(); // Executa o script principal
