import { OCRFile, OCRResult, Settings } from '@/types';

const mockTexts = [
  {
    text: `INVOICE\n\nABC Company Ltd.\n123 Business Street\nNew York, NY 10001\n\nInvoice #: INV-2024-001\nDate: March 15, 2024\nDue Date: April 15, 2024\n\nBill To:\nXYZ Corporation\n456 Client Avenue\nLos Angeles, CA 90001\n\nDescription                    Qty    Rate      Amount\nWeb Development Services        40    $150.00   $6,000.00\nUI/UX Design                   20    $120.00   $2,400.00\nProject Management             10    $100.00   $1,000.00\n\n                              Subtotal: $9,400.00\n                                   Tax: $940.00\n                                 Total: $10,340.00\n\nPayment Terms: Net 30 days\nThank you for your business!`,
    type: 'Invoice',
    language: 'English',
  },
  {
    text: `RESEARCH REPORT\n\nThe Impact of Artificial Intelligence on Modern Business\n\nExecutive Summary\n\nThis comprehensive study examines the transformative effects of AI technology across various industry sectors. Our research indicates that 78% of businesses have implemented some form of AI solution, with significant improvements in operational efficiency and customer satisfaction.\n\nKey Findings:\n• Productivity increased by an average of 35%\n• Customer response times reduced by 60%\n• Cost savings of approximately $2.3M annually\n• Employee satisfaction improved due to automation of repetitive tasks\n\nThe study surveyed 500 companies across technology, healthcare, finance, and manufacturing sectors over a 12-month period.\n\nMethodology\n\nData collection involved structured interviews, performance metrics analysis, and longitudinal tracking of key performance indicators. Statistical analysis was performed using advanced machine learning algorithms to identify patterns and correlations.\n\nConclusions\n\nAI adoption represents a fundamental shift in business operations, offering unprecedented opportunities for growth and innovation while requiring careful consideration of ethical implications and workforce adaptation strategies.`,
    type: 'Report',
    language: 'English',
  },
  {
    text: `MENU\n\nBELLA VISTA RESTAURANT\nAuthentic Italian Cuisine\n\nAPPETIZERS\nBruschetta al Pomodoro                    $12\nFresh tomatoes, basil, garlic on toasted bread\n\nAntipasto Misto                           $18\nSelection of cured meats, cheeses, olives\n\nCalamari Fritti                          $16\nCrispy fried squid with marinara sauce\n\nPASTA\nSpaghetti Carbonara                       $22\nEggs, pancetta, parmesan, black pepper\n\nFettuccine Alfredo                        $20\nCreamy parmesan sauce with fresh herbs\n\nPenne Arrabbiata                          $19\nSpicy tomato sauce with garlic and chili\n\nMAIN COURSES\nOsso Buco alla Milanese                   $32\nBraised veal shanks with saffron risotto\n\nBranzino al Sale                          $28\nSea bass baked in sea salt crust\n\nBistecca alla Fiorentina                  $45\nGrilled T-bone steak with rosemary\n\nDESSERTS\nTiramisu                                  $9\nClassic coffee-flavored dessert\n\nPanna Cotta                               $8\nVanilla custard with berry compote\n\nWine List Available\nReservations Recommended: (555) 123-4567`,
    type: 'Menu',
    language: 'English',
  },
];

export async function mockProcessing(
  files: OCRFile[],
  settings: Settings
): Promise<OCRResult[]> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Reference settings to avoid unused parameter warning in strict builds
  void settings;

  return files.map((file, index) => {
    const mock = mockTexts[index % mockTexts.length];

    return {
      id: `result-${Date.now()}-${index}`,
      fileId: file.id,
      extractedText: mock.text,
      layoutPreserved: mock.text,
      detectedLanguage: mock.language,
      confidence: 0.85 + Math.random() * 0.15,
      documentType: mock.type,
      processingTime: 2.5 + Math.random() * 2,
      layoutAnalysis: {
        textBlocks: Math.floor(Math.random() * 5) + 3,
        tables: Math.floor(Math.random() * 3),
        images: Math.floor(Math.random() * 2),
        columns: Math.floor(Math.random() * 3) + 1,
        complexity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        structure: [],
      },
      metadata: {
        wordCount: mock.text.split(/\s+/).length,
        characterCount: mock.text.length,
        pageCount: 1,
      },
    };
  });
}
