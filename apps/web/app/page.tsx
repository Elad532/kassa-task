'use client';

import { useEffect, useState } from 'react';
import { Dummy } from '@kassa-task/common';

export default function Home() {
  const [data, setData] = useState<Dummy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!data) return <p>No data</p>;

  return (
    <main>
      <h1>{data.message}</h1>
    </main>
  );
}
