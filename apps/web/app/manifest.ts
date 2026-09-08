import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SST Intelligence',
    short_name: 'SST',
    description: 'Operación profesional de seguridad y salud en el trabajo.',
    start_url: '/app/field',
    display: 'standalone',
    background_color: '#f5f7f4',
    theme_color: '#16362c',
    lang: 'es-EC',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
