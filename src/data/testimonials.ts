/**
 * DEMO testimonials.
 *
 * IMPORTANT: These entries are placeholders used to render the testimonials
 * section layout. They are NOT real students. Every entry is flagged with
 * `isDemo: true`. Replace with real, consented testimonials before launch —
 * or hide the section entirely when no real testimonials exist yet.
 */
export type Testimonial = {
  id: string;
  name: string;
  profession: string;
  photoUrl: string | null;
  quoteJa: string;
  quoteEn: string;
  rating: 1 | 2 | 3 | 4 | 5;
  videoUrl: string | null;
  published: boolean;
  isDemo: boolean;
};

export const demoTestimonials: Testimonial[] = [
  {
    id: "demo-1",
    name: "サンプル 花子",
    profession: "会社員 / Office worker",
    photoUrl: null,
    quoteJa:
      "毎日の通勤時間に少しずつ学習を続けられました。半年で英語のメールを一人で書けるようになりました。",
    quoteEn:
      "I was able to keep studying a little every day during my commute. After six months I can write English emails on my own.",
    rating: 5,
    videoUrl: null,
    published: true,
    isDemo: true,
  },
  {
    id: "demo-2",
    name: "サンプル 太郎",
    profession: "エンジニア / Engineer",
    photoUrl: null,
    quoteJa:
      "文法から発音まで順序立てて学べる構成が気に入っています。海外の同僚との会議にも自信が持てるようになりました。",
    quoteEn:
      "I love the structured path from grammar to pronunciation. I now feel confident in meetings with overseas colleagues.",
    rating: 5,
    videoUrl: null,
    published: true,
    isDemo: true,
  },
  {
    id: "demo-3",
    name: "サンプル 美咲",
    profession: "大学生 / University student",
    photoUrl: null,
    quoteJa:
      "TOEIC対策と旅行英会話の両方に役立ちました。スマホで復習できるのが本当に便利です。",
    quoteEn:
      "It helped me with both TOEIC and travel conversation. Being able to review on my phone is genuinely useful.",
    rating: 4,
    videoUrl: null,
    published: true,
    isDemo: true,
  },
];
