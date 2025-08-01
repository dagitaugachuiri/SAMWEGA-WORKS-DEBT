import Head from 'next/head';

export default function Layout({ children, title = 'Samwega Debt Management' }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Samwega Works Ltd. Debt Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {children}
    </>
  );
}
