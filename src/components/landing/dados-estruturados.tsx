import { getSiteConfig } from "@/lib/cms";
import { ENDERECO, MAPA_URL, SITE_URL } from "@/lib/site";

// Schema.org da academia: diz ao Google o que é o studio, onde fica e como falar com ele.
export async function DadosEstruturados() {
  const c = await getSiteConfig();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    name: "CG Studio",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo-crop.svg`,
    description: c.meta_descricao,
    telephone: `+${c.whatsapp}`,
    hasMap: MAPA_URL,
    address: {
      "@type": "PostalAddress",
      streetAddress: ENDERECO.logradouro,
      addressLocality: `${ENDERECO.bairro}, ${ENDERECO.cidade}`,
      addressRegion: ENDERECO.uf,
      postalCode: ENDERECO.cep,
      addressCountry: "BR",
    },
    sameAs: [`https://instagram.com/${c.instagram}`],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
