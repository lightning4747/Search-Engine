export const stopwords = new Set<string>([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', "aren't", 'arent', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  "can't", 'cant', 'cannot', 'could', "couldn't", 'couldnt',
  'did', "didn't", 'didnt', 'do', 'does', "doesn't", 'doesnt', 'doing', "don't", 'dont', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', "hadn't", 'hadnt', 'has', "hasn't", 'hasnt', 'have', "haven't", 'havent', 'having',
  'he', "he'd", "he'll", "he's", 'hed', 'hell', 'hes', 'her', 'here', "here's", 'heres', 'hers', 'herself',
  'him', 'himself', 'his', 'how', "how's", 'hows',
  'i', "i'd", "i'll", "i'm", "i've", 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', "isn't", 'isnt',
  'it', "it's", 'its', 'itself',
  "let's", 'lets', 'me', 'more', 'most', "mustn't", 'mustnt', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', "shan't", 'shant', 'she', "she'd", "she'll", "she's", 'shed', 'shell', 'shes', 'should', "shouldn't", 'shouldnt', 'so', 'some', 'such',
  'than', 'that', "that's", 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', "there's", 'theres', 'these',
  'they', "they'd", "they'll", "they're", "they've", 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', "wasn't", 'wasnt', 'we', "we'd", "we'll", "we're", "we've", 'wed', 'well', 'were', 'weve', "weren't", 'werent',
  'what', "what's", 'whats', 'when', "when's", 'whens', 'where', "where's", 'wheres', 'which', 'while',
  'who', "who's", 'whos', 'whom', 'why', "why's", 'whys', 'with', "won't", 'wont', 'would', "wouldn't", 'wouldnt',
  'you', "you'd", "you'll", "you're", "you've", 'youd', 'youll', 'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves'
]);

export function isStopword(word: string): boolean {
  return stopwords.has(word.toLowerCase());
}
