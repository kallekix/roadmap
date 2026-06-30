import "./globals.css";

export const metadata = {
  title: "Roadmap Planner",
  description: "Product roadmap planner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
