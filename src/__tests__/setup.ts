process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.OPENAI_API_KEY = 'test-key-for-testing-purposes-only';
process.env.API_KEY_SECRET = 'test-secret-key-for-testing-purposes-only-must-be-32-chars';

jest.setTimeout(30000);

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  ingredients: [
                    { name: 'test ingredient', confidence: 0.9 },
                  ],
                  dish_recognized: true,
                  confidence: 0.9,
                }),
              },
            },
          ],
        }),
      },
    },
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Setup', () => {
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
