# Smart Data Analyzer 🚀

Smart Data Analyzer is a powerful, mobile-ready web application designed for automated data processing and AI-driven insights. Built with a Flask backend and a modern JavaScript frontend, it enables users to upload, analyze, and visualize their data effortlessly.

## ✨ Features

- **📂 Multi-format Upload**: Support for CSV and Excel (.xlsx) files up to 50MB.
- **📊 Automated Analysis**: Comprehensive statistical breakdown of Numeric, Categorical, Text, and Datetime data.
- **🔍 Advanced Data Insights**:
  - Outlier detection (IQR method).
  - Correlation analysis with strength indicators.
  - Data quality reporting (missing values, duplicates, cardinality).
- **📉 Interactive Visualizations**: Dynamic histograms and scatter plots powered by Chart.js.
- **🤖 AI-Powered Insights**: Automated discovery of patterns and trends using Mistral AI (via Ollama).
- **📱 Responsive UI**: Clean, mobile-friendly design with a dark-themed aesthetic.

## 🛠️ Tech Stack

- **Backend**: Python, Flask, Pandas, NumPy, Scipy
- **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+), Chart.js
- **AI Engine**: Mistral AI (Ollama)
- **Styling**: Google Fonts (Poppins), Font Awesome icons

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.com/) (for AI insights)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pastewizz/Smart-Data-App.git
   cd Smart-Data-App
   ```

2. **Install dependencies**:
   ```bash
   pip install -r "requirements (3).txt"
   ```

3. **Set up AI (Optional but recommended)**:
   Ensure Ollama is running and the Mistral model is pulled:
   ```bash
   ollama pull mistral
   ```

4. **Run the application**:
   ```bash
   python backend/app.py
   ```
   The app will be available at `http://localhost:5000`.

## 📁 Project Structure

```text
├── backend/
│   ├── app.py              # Flask server & routes
│   ├── data_processor.py   # Core analysis & AI logic
│   └── uploads/            # Temporary storage for uploaded files
├── frontend/
│   ├── index.html          # Main application UI
│   └── static/
│       ├── css/            # Stylesheets
│       └── js/             # Frontend logic & Chart.js integration
└── requirements (3).txt    # Python dependencies
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
