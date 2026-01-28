/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');
module.exports = {
    content: [
        './Views/**/*.cshtml',
        './Areas/**/Views/**/*.cshtml',
        './Pages/**/*.cshtml',
        './wwwroot/js/**/*.js'
    ],
    safelist: [
        {
            pattern: /(bg|text|border)-(slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900)/,
            variants: ['hover', 'focus']
        }
    ],
    theme: {
        extend: {
            fontFamily: {
                yekan: ['IRANSansWeb_Light', 'sans-serif'],
            },
            colors: {
                slate: colors.slate,
                gray: colors.gray,
                neutral: colors.neutral,
                stone: colors.stone,
                red: colors.red,
                orange: colors.orange,
                amber: colors.amber,
                yellow: colors.yellow,
                lime: colors.lime,
                green: colors.green,
                emerald: colors.emerald,
                teal: colors.teal,
                cyan: colors.cyan,
                sky: colors.sky,
                blue: colors.blue,
                indigo: colors.indigo,
                violet: colors.violet,
                purple: colors.purple,
                fuchsia: colors.fuchsia,
                pink: colors.pink,
                rose: colors.rose
            },
            screens: {
                'tablet': '640px',
                // => @media (min-width: 640px) { ... }

                'laptop': '1024px',
                // => @media (min-width: 1024px) { ... }

                'desktop': '1280px',
                // => @media (min-width: 1280px) { ... }
            },
            animation: {
                fadeInUp: 'fadeInUp 0.3s ease-out',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            backgroundImage: {
                'bg-svg-grid': "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='%23f1f5f9'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e\")",
            },
        },
        plugins: [],
    }
}
