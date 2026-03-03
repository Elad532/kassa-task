'use client';

export default function NavBar() {
  return (
    <nav>
      <a href="/">End User</a>
      <a href="/admin">Admin</a>
      <input type="password" placeholder="Gemini API key" />
    </nav>
  );
}
