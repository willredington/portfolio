import React from 'react';
import Head from 'next/head';
import Title from '@/components/Title';

const Home: React.FC = () => (
  <div className="container">
    <Head>
      <title>Create Next App</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>

    <main>
      <Title />
    </main>
  </div>
);

export default Home;
