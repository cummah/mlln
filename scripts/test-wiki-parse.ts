import https from 'https'

async function fetchWikipedia(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function main() {
  const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
  console.log('Fetching Wikipedia...')
  const html = await fetchWikipedia(url)

  // Check if we got the page
  console.log(`Page size: ${html.length} bytes`)
  console.log(`Contains "constituents": ${html.includes('constituents')}`)
  console.log(`Contains "Ticker": ${html.includes('Ticker')}`)
  console.log(`Contains "<tr": ${html.match(/<tr/gi)?.length || 0} <tr tags`)

  // Look for table structure
  const tableMatches = html.match(/<table[^>]*>/gi)
  console.log(`\nFound ${tableMatches?.length || 0} <table> tags`)

  if (tableMatches) {
    for (let i = 0; i < Math.min(3, tableMatches.length); i++) {
      console.log(`Table ${i}: ${tableMatches[i]}`)
    }
  }

  // Check for the constituents table more flexibly
  const constituentIndex = html.indexOf('constituents')
  if (constituentIndex !== -1) {
    console.log(`\nFound 'constituents' at position ${constituentIndex}`)
    console.log(`Context: ${html.substring(constituentIndex - 50, constituentIndex + 100)}`)
  }

  // Look for table rows in general
  const rows = html.match(/<tr[^>]*>[\s\S]{0,500}?<\/tr>/g)
  console.log(`\nFound approximately ${rows?.length || 0} table rows`)

  if (rows && rows.length > 0) {
    console.log(`\nFirst row sample:`)
    console.log(rows[0].substring(0, 500))
  }
}

main().catch(console.error)
