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
;(async function () {
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

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      await startBadApple(file)
    } catch (err) {
      console.error('Error playing Bad Apple:', err)
      alert('Error: ' + err.message)
    }
  })

  async function startBadApple(file) {
    const arrayBuffer = await file.arrayBuffer()
    const ds = new DecompressionStream('gzip')
    const decompressedStream = new Response(arrayBuffer).body.pipeThrough(ds)
    const decompressedBuffer = await new Response(decompressedStream).arrayBuffer()
    const data = new Uint8Array(decompressedBuffer)

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
      // Fallback or guess
      console.warn('Could not parse resolution from filename, defaulting to 640x480')
    }

    console.log(`Video: ${videoWidth}x${videoHeight} @ ${fps}fps`)

    //Prepare the Table
    //Change the table2 to any tag on table that you want to change
    const table = document.getElementById('table2')
    if (!table) throw new Error(`Table ${table} not found`)

    if (table.parentElement) {
      table.parentElement.style.height = 'auto'
      table.parentElement.style.overflow = 'visible'
    }

    const tbody = table.querySelector('tbody')
    const thead = table.querySelector('thead')
    const rows = tbody.querySelectorAll('tr')

    //Calculate Layout
    //We want to maintain aspect ratio of the VIDEO (e.g. 4:3) on the TABLE.
    //Video Ratio (VR) = videoWidth / videoHeight
    //Table Ratio (TR) = tableCols / tableRows

    //We want Final Table Ratio ≈ Video Ratio.
    //If we have fixed Rows, we adjust Cols: Cols = Rows * VR
    //If we have fixed Cols, we adjust Rows: Rows = Cols / VR

    //To minimize disruption to existing content we "Anchor" on the dimension that is "larger"
    //relative to the aspect ratio? No, we anchor on the one that implies the other needs to EXPAND.
    //We don't want to shrink the table (delete rows/cols).

    const rowCount = rows.length
    const firstRowCells = rows[0].querySelectorAll('td')
    const existingColCount = firstRowCells.length

    const videoRatio = videoWidth / videoHeight
    const tableRatio = existingColCount / rowCount

    let targetColCount = existingColCount
    let targetRowCount = rowCount

    console.log(`Current Table: ${existingColCount}x${rowCount} (Ratio: ${tableRatio.toFixed(2)})`)
    console.log(`Target Video Ratio: ${videoRatio.toFixed(2)}`)

    if (tableRatio < videoRatio) {
      //Table is too tall/narrow (e.g. 8x16 = 0.5 < 1.33).
      //We need to WIDEN it (add columns).
      //Anchor: Rows.
      targetColCount = Math.ceil(rowCount * videoRatio * 2)
      targetColCount = Math.ceil(rowCount * videoRatio * 1.8)

      console.log(`Expanding Columns from ${existingColCount} to ${targetColCount}`)
    } else {
      //Table is too wide/short (e.g. 100x10 = 10 > 1.33).
      //We need to HEIGHTEN it (add rows).
      //Anchor: Cols.
      targetRowCount = Math.ceil(existingColCount / (videoRatio * 1.8))
      console.log(`Expanding Rows from ${rowCount} to ${targetRowCount}`)
    }

    //Ensure we don't shrink
    const finalCols = Math.max(targetColCount, existingColCount)
    const finalRows = Math.max(targetRowCount, rowCount)

    //Measure existing cell dimensions
    let cellWidth = '10px'
    let cellHeight = '10px'
    let squareSize = 10

    //Find a cell with content or just the first one
    if (rows.length > 0) {
      const sampleCell = rows[0].querySelector('td div') || rows[0].querySelector('td')
      if (sampleCell) {
        const rect = sampleCell.getBoundingClientRect()
        let _w = rect.width
        let _h = rect.height

        //If sampleCell was just a TD without DIV, and it has no explicit size,
        //getComputedStyle might be safer
        const style = window.getComputedStyle(sampleCell)
        if (!style.width || style.width === 'auto') {
          //Fallback
        } else {
          _w = parseFloat(style.width) || _w
          _h = parseFloat(style.height) || _h
        }

        //Force all cell to 1:1 ratio
        squareSize = Math.min(_w, _h)
        if (squareSize < 2) squareSize = 2

        cellWidth = squareSize + 'px'
        cellHeight = squareSize + 'px'
      }
    }

    console.log(`Forcing square cells: ${squareSize}px (from sampled ${cellWidth} x ${cellHeight})`)

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

    //FORCE resizing existing cells in the table to matches this square ratio
    //This is destructive to original view but required for grid consistency
    const allCells = table.querySelectorAll('td, th')
    allCells.forEach((cell) => {
      styleCell(cell)
      //Also if there's a div inside, style it too?
      const div = cell.querySelector('div')
      if (div) styleCell(div)
    })

    //Expand Columns
    //Add columns to Header
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

    //Add columns to existing rows
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

    //Expand Rows (if needed)
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

    //Update our grid loop bounds
    const gridRows = finalRows
    const gridCols = finalCols

    //Pre-calculate mapping
    //Reload rows in case we added some
    const allRows = tbody.querySelectorAll('tr')

    //Cache the cell elements for fast access
    const grid = []
    for (let r = 0; r < gridRows; r++) {
      const row = allRows[r]
      if (!row) continue

      const rowCells = row.querySelectorAll('td')
      const rowArr = []
      for (let c = 0; c < rowCells.length; c++) {
        let target = rowCells[c].querySelector('div')
        if (!target) {
          target = rowCells[c]
        }
        rowArr.push(target)
      }
      grid.push(rowArr)
    }

    //Animation Loop
    console.log('Starting animation...')
    let frame = 0
    const interval = 1000 / fps
    const totalFrames = Math.floor(data.length / (Math.ceil(videoWidth / 8) * videoHeight))

    //Pre-calc bytes per line for speed
    const rowBytes = Math.ceil(videoWidth / 8)
    const frameBytes = rowBytes * videoHeight

    setInterval(() => {
      const frameOffset = frame * frameBytes
      if (frameOffset >= data.length) {
        frame = 0
        return
      }

      for (let r = 0; r < gridRows; r++) {
        //Map table row 'r' to video row 'vy'
        const vy = Math.floor((r * videoHeight) / gridRows)

        for (let c = 0; c < gridCols; c++) {
          //Map table col 'c' to video col 'vx'
          const vx = Math.floor((c * videoWidth) / gridCols)

          //Get pixel (vx, vy)
          const byteIndex = frameOffset + vy * rowBytes + Math.floor(vx / 8)
          const bitIndex = vx % 8

          //Safety check
          if (byteIndex < data.length) {
            const isWhite = (data[byteIndex] & (0x80 >> bitIndex)) !== 0

            if (grid[r] && grid[r][c]) {
              grid[r][c].style.background = isWhite ? '#FFF' : '#000'
            }
          }
        }
      }

      frame = (frame + 1) % totalFrames
    }, interval)
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
