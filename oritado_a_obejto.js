class CSVGenerator {
    static createCSV(data, fileName) {
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
  }
  
  class ContentCollector {
    constructor() {
      this.allContent = new Set();
      this.maxPosts = 200;
      this.processedPosts = 0;
    }
  
    getEmailFromText(text) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      return (text?.match(emailRegex)?.[0]) || '';
    }
  
    clickOnComments(post) {
      const commentButton = post.querySelector('[data-visualcompletion="ignore-dynamic"]');
      if (commentButton && typeof commentButton.click === 'function') {
        commentButton.click();
        return 'Comentário clicado com sucesso';
      }
      return 'Botão de comentários não encontrado ou não é clicável';
    }
  
    collectPosts() {
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
  
        this.allContent.add(JSON.stringify(postData));
        return post;
      });
    }
  
    addCommentsToContent(comments = []) {
      comments.forEach(c => {
        this.allContent.add(JSON.stringify(c));
      });
    }
  }
  
  class APIInterceptor extends ContentCollector {
    interceptRequests() {
      const oldXHROpen = window.XMLHttpRequest.prototype.open;
  
      window.XMLHttpRequest.prototype.open = (method, url, async) => {
        if (url && /graphql/i.test(url)) {
          let requestBody = null;
          const oldXHRSend = this.send;
  
          this.send = function (data) {
            requestBody = data;
            oldXHRSend.apply(this, arguments);
          };
  
          this.addEventListener('load', () => {
            setTimeout(() => {
              try {
                const responseText = this.responseText;
                if (!responseText || typeof responseText !== 'string') {
                  console.warn('Resposta vazia ou inválida:', responseText);
                  return;
                }
  
                const lines = responseText.split('\n').filter(line => line.trim());
  
                if (requestBody && (requestBody.includes('GroupsCometFeedRegularStoriesPaginationQuery') || requestBody.includes('FeedQuery'))) {
                  if (lines.length >= 3 && this.processedPosts < this.maxPosts) {
                    lines.slice(0, 3).forEach((line, index) => {
                      try {
                        const postData = JSON.parse(line);
                        const postText = this.deepFind(postData, 'postText') || 'Texto não encontrado';
                        const postAuthor = this.deepFind(postData, 'postAuthor') || 'Autor desconhecido';
                        const postAuthorId = this.deepFind(postData, 'postAuthorId') || 'ID desconhecido';
  
                        const parsedData = {
                          postId: `post_${this.processedPosts}`,
                          postText: postText,
                          postAuthor: postAuthor,
                          postAuthorId: postAuthorId,
                        };
  
                        this.allContent.add(JSON.stringify(parsedData));
                        this.processedPosts++;
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
  
                  if (data?.data && this.processedPosts < this.maxPosts) {
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
                          email: this.getEmailFromText(comment?.body?.text),
                          firstName: comment?.author?.name?.split(' ')?.[0] || 'Desconhecido',
                          lastName: comment?.author?.name?.split(' ')?.[1] || '',
                        };
                      });
                      this.addCommentsToContent(formattedComments);
                      this.processedPosts++;
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
  }
  
  // Função principal
  async function run() {
    const contentCollector = new APIInterceptor();
    contentCollector.interceptRequests();
  
    console.log('Iniciando...');
  
    let posts = contentCollector.collectPosts();
    let i = 0;
  
    while (i < posts.length && contentCollector.processedPosts < contentCollector.maxPosts) {
      const post = posts[i];
      contentCollector.clickOnComments(post);
      await new Promise(resolve => setTimeout(resolve, 1000));
      i++;
    }
  
    const formattedContent = Array.from(contentCollector.allContent).map(JSON.parse);
    CSVGenerator.createCSV(formattedContent, 'facebookGroupPostsAndComments.csv');
    console.log('Finalizado!');
  }
  
  run();
  