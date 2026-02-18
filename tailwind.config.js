/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            animation: {
                'fade-in-up': 'fadeInUp 0.5s ease-out',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            },
            colors: {
                gray: {
                    750: '#2d3748',
                    850: '#1a202c',
                    950: '#0d1117',
                },
                gold: {
                    50: '#FBF8EB',
                    100: '#F5EFCF',
                    200: '#EAD99F',
                    300: '#DFC36F',
                    400: '#D4AF37', /* Base Metallic Gold */
                    500: '#B5952F',
                    600: '#967C27',
                    700: '#77621F',
                    800: '#584817',
                    900: '#392F0F',
                }
            }
        }
    },
    plugins: [],
}
