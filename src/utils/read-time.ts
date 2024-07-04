import getReadingTime from 'reading-time'
import { toString } from 'mdast-util-to-string'

/**
 * Injects `minutesRead` into frontmatter processed by Remark.
 */
export function remarkReadingTime() {
  return function (tree: unknown, { data }: any) {
    const textOnPage = toString(tree)
    const readingTime = getReadingTime(textOnPage)
    const [time] = readingTime.text.split(' ')
    data.astro.frontmatter.minutesRead = `共 ${readingTime.words} 字，预计阅读 ${time} 分钟`
  }
}
