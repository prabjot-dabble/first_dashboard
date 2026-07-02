# Dabble P&L Dashboard

A premium, interactive web application to visualize and analyze daily Profit & Loss (P&L), marketing spends, ROAS, and monthly target completions for the Dabble brand.

## Key Features
- **Month-over-Month Filter Toggles**: Dynamically switch dashboard views between May 2026, June 2026, or a Comparative View.
- **Interactive Timelines & Mix Charts**: Custom visual graphs utilizing **ApexCharts** to track Total GMV, marketing costs, and ROAS contributions.
- **Google Top-ups Tracker**: Dedicated sidebar ledger logging budget injections.
- **Dynamic Transaction Sheet**: Searchable, paginated, and sortable daily record log.

## Technologies Used
- **Frontend structure**: HTML5 & Vanilla CSS (custom HSL color palette, dark theme, and glassmorphic panels).
- **Logic**: Vanilla ES6 JavaScript.
- **Libraries (via CDN)**:
  - [ApexCharts](https://apexcharts.com/) for interactive data visualizations.
  - [PapaParse](https://www.papaparse.com/) for streaming local CSV data files.
  - [Lucide Icons](https://lucide.dev/) for vector iconography.

## Getting Started Locally

To run the application locally without browser CORS blockages, run a local development server in this directory:

### Using Python:
```bash
python -m http.server 8080
```
Then visit: `http://localhost:8080/index.html`

### Using Node.js / NPM:
```bash
npx http-server -p 8080
```
Then visit: `http://localhost:8080`
