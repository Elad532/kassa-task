'use client';

export default function SearchSurface() {
  return (
    <main>
      <div>Drop image here or click to upload</div>
      <input
        type="text"
        placeholder="Add details like color, style, or price range to refine results"
      />
      <button type="submit">Search</button>
    </main>
  );
}
