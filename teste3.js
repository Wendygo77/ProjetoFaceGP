const allContent = [] // Cria um array vazio chamado allContent para armazenar os dados coletados dos posts e comentários.

function createCSV(data, fileName) { // Define uma função createCSV para criar um arquivo CSV a partir dos dados fornecidos.
  const headers = [ // Define os cabeçalhos (colunas) para o arquivo CSV. Cada campo representa uma propriedade de um post ou comentário.
    'id',
    'email',
    'firstName',
    'lastName',
    'postId',
    'postText',
    'postAuthor',
    'postAuthorId',
    'postAuthorUrl',
    'commentId',
    'commentText',
    'commentAuthorName',
    'commentAuthorId',
    'commentAuthorUrl',
    'timestamp',
    'commentUrl',
  ]

  const csvContent = [  // Cria o conteúdo do CSV. Concatena os valores de cada linha de dados com os cabeçalhos e trata strings para remover aspas duplicadas.
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          if (value === null) return 'null'
          if (typeof value === 'string') {
            // Wrap all fields, including those without commas, in double quotes
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(','),
    ),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }) // Cria um Blob com o conteúdo CSV e um elemento <a> para fazer o download do arquivo.
  const link = document.createElement('a')

  if (navigator.msSaveBlob) {
    // IE 10+
    navigator.msSaveBlob(blob, fileName)
  } else {
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', fileName || 'data.csv')
    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

async function scrollDown() {
  // const wrapper = document.querySelector("#search-page-list-container");
  const wrapper = window
  await new Promise((resolve, reject) => {
    var totalHeight = 0
    var distance = 800

    var timer = setInterval(async () => {
      var scrollHeightBefore = wrapper.scrollHeight
      wrapper.scrollBy(0, distance)
      totalHeight += distance

      clearInterval(timer)
      resolve()
    }, 400)
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))
}

function getEmailFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const email = text?.match(emailRegex)?.[0]
  return email || ''
}

function clickOnComments(post) {
  // Get all divs on the page
  var allDivs = post.getElementsByTagName('div')

  // Create an array to store matching divs
  var matchingDivs = []

  // Loop through each div
  for (var i = 0; i < allDivs.length; i++) {
    // Check if the div has the attribute data-visualcompletion set to "ignore-dynamic"
    if (allDivs[i].getAttribute('data-visualcompletion') === 'ignore-dynamic') {
      // Add the matching div to the array
      matchingDivs.push(allDivs[i])
      const thingToClickToOpenComments =
        allDivs?.[i]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]
          ?.children?.[0]?.children?.[1]?.children?.[1]?.children?.[0]
          ?.children?.[0]
      if (thingToClickToOpenComments) {
        thingToClickToOpenComments.click()
      }
    }
  }
}

// Function to recursively traverse HTML elements and return text in an array
function traverseElementsToGetText(element) {
  var textArray = []

  // Check if the element has child nodes
  if (element.childNodes.length > 0) {
    // Loop through each child node
    for (var i = 0; i < element.childNodes.length; i++) {
      // Recursively call the function for each child node
      textArray = textArray.concat(
        traverseElementsToGetText(element.childNodes[i]),
      )
    }
  } else {
    // If the element is a text node and contains non-whitespace text
    if (
      element.nodeType === Node.TEXT_NODE &&
      element.nodeValue.trim() !== ''
    ) {
      // Push the text into the text array
      textArray.push(element.nodeValue.trim())
    }
  }

  return textArray
}

function getAllPosts() {
  // Seleciona todos os posts que contenham um elemento <h2>, <h3> ou <span> (para nomes de autores)
  return [...document.querySelectorAll('div[role=feed] > div')].filter(post => 
    post.querySelector('h2') || post.querySelector('h3') || post.querySelector('span')
  );
}


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function closeDialog() {
  const closeButton = document?.querySelector('div[aria-label="Close"]')
  if (!closeButton) {
    return
  }
  closeButton.click()
}

function formatTopLevelComments(postId, topLevelComments = []) {
  return topLevelComments.map((c) => {
    const text = c?.comment.body.text
    const commentId = c?.comment.id
    const authorName = c?.comment.author.name
    const authorId = c?.comment.author.id
    return {
      id: commentId,
      commentId,
      postId,
      commentText: text || '',
      commentAuthorName: authorName,
      commentAuthorId: authorId,
      email: getEmailFromText(text),
      firstName: authorName?.split(' ')?.[0],
      lastName: authorName?.split(' ')?.[1],
    }
  })
}

function parsePostData(json, level = 1) {
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
console.log
function addCommentsToAllContent(comments = []) {
  comments.forEach((c) => {
    if (allContent?.find((f) => f.commentId === c.commentId)) {
    } else {
      allContent.push(c)
    }
  })
}

function interceptRequests() {
  let oldXHROpen = window.XMLHttpRequest.prototype.open
  window.XMLHttpRequest.prototype.open = function (method, url, async) {
    if (!url.includes('graphql')) {
      return oldXHROpen.apply(this, arguments)
    }
    // Capture the request body
    let requestBody = null

    // Override the send method to capture the request body
    let oldXHRSend = this.send
    this.send = function (data) {
      requestBody = data
      oldXHRSend.apply(this, arguments)
    }

    // Listen for the 'load' event to capture the response
    this.addEventListener('load', function () {
      if (
        requestBody?.includes('GroupsCometFeedRegularStoriesPaginationQuery')
      ) {
        console.log('getting posts')
        // we're getting posts.... 
        const payload = this.responseText
        const lines = payload.split('\n')

        if (lines.length >= 3) {
          try {
            const data1 = JSON.parse(lines[0])
            const data2 = JSON.parse(lines[1])
            const json = JSON.parse(lines[2])
            console.log(json)

            const { post, topLevelComments } = parsePostData(json) // Utiliza a nova função parsePostData.

            addCommentsToAllContent(topLevelComments) // Adiciona os comentários ao allContent.

            console.log('post:', post) // Adiciona o post a allContent.
            allContent.push(post)
          } catch (e) {
            console.error('Erro ao processar os dados:', e)
          }
        }
      }
    })
    return oldXHROpen.apply(this, arguments)
  }
}

function downloadData() {
  const csvData = allContent.map((content) => {
    return {
      ...content,
      ...content.topLevelComments.reduce(
        (acc, comment) => ({
          ...acc,
          ...comment,
        }),
        {}
      ),
    }
  })

  createCSV(csvData, 'data.csv')
}

// Chama as funções para interceptar solicitações e começar a rolar a página para carregar os posts
interceptRequests()
scrollDown().then(() => {
  // Função para salvar os dados após rolar a página
  downloadData()
})
