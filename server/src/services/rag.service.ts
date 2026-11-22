import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { BadRequestError } from '../errors/AppError';

export interface PageText {
  pageNumber: number;
  text: string;
}

export interface TextChunk {
  chunkText: string;
  pageNumber: number;
}

export class RagService {
  /**
   * Extracts text page-by-page from a PDF buffer using pdf-parse.
   */
  static async extractPagesFromPdf(buffer: Buffer): Promise<PageText[]> {
    const pageTexts: PageText[] = [];

    const options: pdf.Options = {
      pagerender: (pageData: any): Promise<string> => {
        return pageData.getTextContent().then((textContent: any) => {
          let lastY: number | undefined;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === undefined || lastY === item.transform[5]) {
              text += item.str + ' ';
            } else {
              text += '\n' + item.str + ' ';
            }
            lastY = item.transform[5];
          }

          const pageNumber = pageData.pageIndex + 1;
          const cleanedText = text.replace(/\s+/g, ' ').trim();
          if (cleanedText) {
            pageTexts.push({ pageNumber, text: cleanedText });
          }

          return text;
        });
      }
    };

    try {
      await pdf(buffer, options);
    } catch (error: any) {
      throw new BadRequestError(`Failed to parse PDF document: ${error.message}`);
    }

    // Sort pages in ascending page order
    pageTexts.sort((a, b) => a.pageNumber - b.pageNumber);

    if (pageTexts.length === 0) {
      throw new BadRequestError('Could not extract any readable text from the provided PDF');
    }

    return pageTexts;
  }

  /**
   * Splits page texts using LangChain's RecursiveCharacterTextSplitter
   * with chunkSize: 800 and chunkOverlap: 150, retaining the pageNumber.
   */
  static async splitIntoChunks(pageTexts: PageText[]): Promise<TextChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 150
    });

    const chunks: TextChunk[] = [];

    for (const page of pageTexts) {
      if (!page.text || page.text.trim().length === 0) continue;

      const pageChunks = await splitter.splitText(page.text);

      for (const chunkText of pageChunks) {
        const trimmed = chunkText.trim();
        if (trimmed.length > 0) {
          chunks.push({
            chunkText: trimmed,
            pageNumber: page.pageNumber
          });
        }
      }
    }

    return chunks;
  }
}
