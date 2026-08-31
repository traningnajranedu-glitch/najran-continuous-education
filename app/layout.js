import "./globals.css";
import "./auto-audio.css";
export const metadata = { title: "استعلام ترشيح معلمي التعليم المستمر", description: "إدارة واستعلام ترشيحات التعليم المستمر - نجران" };
export default function RootLayout({children}) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}