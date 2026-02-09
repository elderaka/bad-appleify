/**
 * Bad Apple Table Injector
 *
 * Instructions:
 * 1. Open any page with a table.
 * 2. Open Developer Tools (F12) -> Console.
 * 3. Paste this entire script, change the table_tag to whatever tag the table has, then enter.
 * 4. A file input will appear at the top of the page.
 * 5. Select your 'bad-apple.bin.gz' file.
 * 6. And just play it lmao
 */

const table_tag = 'table2'
const DEFAULT_YT_ID = 'FtutLA63Cp8'

;(async function () {
  let ytPlayer = null
  let ytReady = false

  const ytPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      onYouTubeIframeAPIReady()
    } else {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    }

    window.onYouTubeIframeAPIReady = () => {
      const playerDiv = document.createElement('div')
      playerDiv.id = 'bad-apple-yt-player'
      playerDiv.style.position = 'fixed'
      playerDiv.style.bottom = '10px'
      playerDiv.style.right = '10px'
      playerDiv.style.width = '200px'
      playerDiv.style.height = '120px'
      playerDiv.style.zIndex = '9999'
      playerDiv.style.border = '2px solid red'
      document.body.appendChild(playerDiv)

      ytPlayer = new window.YT.Player('bad-apple-yt-player', {
        height: '120',
        width: '200',
        videoId: DEFAULT_YT_ID,
        playerVars: {
          autoplay: 0,
          controls: 1,
        },
        events: {
          onReady: () => {
            ytReady = true
            console.log('YouTube Player Ready')
            resolve()
          },
        },
      })
    }
  })

  // UI for file upload
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.bin.gz'
  input.style.position = 'fixed'
  input.style.top = '10px'
  input.style.left = '10px'
  input.style.zIndex = '9999'
  input.style.padding = '10px'
  input.style.background = 'white'
  input.style.border = '2px solid red'
  document.body.appendChild(input)

  const statusMsg = document.createElement('div')
  statusMsg.style.position = 'fixed'
  statusMsg.style.top = '60px'
  statusMsg.style.left = '10px'
  statusMsg.style.zIndex = '9999'
  statusMsg.style.color = 'red'
  statusMsg.style.fontWeight = 'bold'
  document.body.appendChild(statusMsg)

  ytPromise.then(() => {
    statusMsg.textContent = 'YouTube Ready. Select .bin.gz file.'
  })

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      statusMsg.textContent = 'Loading and decompressing video data...'
      await startBadApple(file)
    } catch (err) {
      console.error('Error playing Bad Apple:', err)
      statusMsg.textContent = 'Error: ' + err.message
    }
  })

  async function startBadApple(file) {
    const arrayBuffer = await file.arrayBuffer()
    const ds = new DecompressionStream('gzip')
    const decompressedStream = new Response(arrayBuffer).body.pipeThrough(ds)
    const decompressedBuffer = await new Response(decompressedStream).arrayBuffer()
    const data = new Uint8Array(decompressedBuffer)

    if (!ytReady) {
      statusMsg.textContent = 'Waiting for YouTube player...'
      await ytPromise
    }

    //Parse filename for metadata.
    const meta = parseFilename(file.name)
    let videoWidth = 640
    let videoHeight = 480
    let fps = 30

    if (meta) {
      videoWidth = meta.width
      videoHeight = meta.height
      fps = meta.fps
    } else {
      console.warn('Could not parse resolution from filename, defaulting to 640x480')
    }

    console.log(`Video: ${videoWidth}x${videoHeight} @ ${fps}fps`)

    //Prepare the Table
    const table = document.getElementById(table_tag)
    if (!table) throw new Error(`Table #${table_tag} not found`)

    if (table.parentElement) {
      table.parentElement.style.height = 'auto'
      table.parentElement.style.overflow = 'visible'
    }

    const tbody = table.querySelector('tbody')
    const rows = tbody.querySelectorAll('tr')

    const rowCount = rows.length
    const firstRowCells = rows[0].querySelectorAll('td')
    const existingColCount = firstRowCells.length

    const videoRatio = videoWidth / videoHeight
    const tableRatio = existingColCount / rowCount

    let targetColCount = existingColCount
    let targetRowCount = rowCount

    if (tableRatio < videoRatio) {
      targetColCount = Math.ceil(rowCount * videoRatio * 1.8)
    } else {
      targetRowCount = Math.ceil(existingColCount / (videoRatio * 1.8))
    }

    const finalCols = Math.max(targetColCount, existingColCount)
    const finalRows = Math.max(targetRowCount, rowCount)

    //Measure existing cell dimensions
    let cellWidth = '10px'
    let cellHeight = '10px'
    let squareSize = 10

    if (rows.length > 0) {
      const sampleCell = rows[0].querySelector('td div') || rows[0].querySelector('td')
      if (sampleCell) {
        const rect = sampleCell.getBoundingClientRect()
        let _w = rect.width
        let _h = rect.height
        const style = window.getComputedStyle(sampleCell)
        if (style.width && style.width !== 'auto') {
          _w = parseFloat(style.width) || _w
          _h = parseFloat(style.height) || _h
        }
        squareSize = Math.min(_w, _h)
        if (squareSize < 2) squareSize = 2
        cellWidth = squareSize + 'px'
        cellHeight = squareSize + 'px'
      }
    }

    const styleCell = (el) => {
      el.style.width = cellWidth
      el.style.height = cellHeight
      el.style.minWidth = cellWidth
      el.style.maxWidth = cellWidth
      el.style.minHeight = cellHeight
      el.style.maxHeight = cellHeight
      el.style.padding = '0'
      el.style.overflow = 'hidden'
      el.style.boxSizing = 'border-box'
    }

    const allCells = table.querySelectorAll('td, th')
    allCells.forEach((cell) => {
      styleCell(cell)
      const div = cell.querySelector('div')
      if (div) styleCell(div)
    })

    //Expand Columns
    const thead = table.querySelector('thead')
    if (thead) {
      const headerRow = thead.querySelector('tr')
      if (headerRow) {
        for (let i = existingColCount; i < finalCols; i++) {
          const th = document.createElement('th')
          th.textContent = '.'
          styleCell(th)
          headerRow.appendChild(th)
        }
      }
    }

    for (let r = 0; r < rowCount; r++) {
      const row = rows[r]
      for (let c = existingColCount; c < finalCols; c++) {
        const td = document.createElement('td')
        styleCell(td)
        const div = document.createElement('div')
        div.style.background = '#F0F0F0'
        styleCell(div)
        td.appendChild(div)
        row.appendChild(td)
      }
    }

    //Expand Rows
    for (let r = rowCount; r < finalRows; r++) {
      const row = document.createElement('tr')
      for (let c = 0; c < finalCols; c++) {
        const td = document.createElement('td')
        styleCell(td)
        const div = document.createElement('div')
        div.style.background = '#F0F0F0'
        styleCell(div)
        td.appendChild(div)
        row.appendChild(td)
      }
      tbody.appendChild(row)
    }

    const gridRows = finalRows
    const gridCols = finalCols
    const allRows = tbody.querySelectorAll('tr')
    const grid = []
    for (let r = 0; r < gridRows; r++) {
      const row = allRows[r]
      if (!row) continue
      const rowCells = row.querySelectorAll('td')
      const rowArr = []
      for (let c = 0; c < rowCells.length; c++) {
        let target = rowCells[c].querySelector('div') || rowCells[c]
        rowArr.push(target)
      }
      grid.push(rowArr)
    }

    //Animation Loop logic
    const rowBytes = Math.ceil(videoWidth / 8)
    const frameBytes = rowBytes * videoHeight
    const totalFrames = Math.floor(data.length / frameBytes)

    statusMsg.textContent = 'Playing...'
    ytPlayer.playVideo()

    let lastFrame = -1

    function update() {
      if (!ytPlayer) return
      const currentTime = ytPlayer.getCurrentTime()
      const currentFrame = Math.floor(currentTime * fps)

      if (currentFrame !== lastFrame && currentFrame < totalFrames) {
        const frameOffset = currentFrame * frameBytes

        for (let r = 0; r < gridRows; r++) {
          const vy = Math.floor((r * videoHeight) / gridRows)
          for (let c = 0; c < gridCols; c++) {
            const vx = Math.floor((c * videoWidth) / gridCols)
            const byteIndex = frameOffset + vy * rowBytes + Math.floor(vx / 8)
            const bitIndex = vx % 8

            if (byteIndex < data.length) {
              const isWhite = (data[byteIndex] & (0x80 >> bitIndex)) !== 0
              if (grid[r] && grid[r][c]) {
                const color = isWhite ? '#FFF' : '#000'
                if (grid[r][c].style.background !== color) {
                  grid[r][c].style.background = color
                }
              }
            }
          }
        }
        lastFrame = currentFrame
      }

      if (currentFrame < totalFrames) {
        requestAnimationFrame(update)
      } else {
        statusMsg.textContent = 'Finished.'
      }
    }

    requestAnimationFrame(update)
  }

  function parseFilename(name) {
    const match = name.match(/(\d+)x(\d+)(?:@(\d+))?/)
    if (match) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2]),
        fps: parseInt(match[3]) || 30,
      }
    }
    return null
  }
})()
