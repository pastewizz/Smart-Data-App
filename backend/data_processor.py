import pandas as pd
import numpy as np
import json
import subprocess
import logging
import re
from scipy import stats
import warnings
import traceback
import markdown
from typing import Optional, List, Dict, Union

warnings.filterwarnings('ignore')

# Setup enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data_analysis.log'),
        logging.StreamHandler()
    ]
)

class DataAnalyzer:
    def __init__(self, file_path: str):
        """
        Initialize the DataAnalyzer with a file path.
        
        Args:
            file_path (str): Path to the data file (CSV or Excel)
        """
        self.file_path = file_path
        self.df = None
        self.load_data()
        self._last_prompt = None
        self._last_response = None

    def load_data(self) -> None:
        """
        Load data from file with comprehensive error handling.
        """
        logging.info(f"Attempting to load file: {self.file_path}")
        try:
            if not self.file_path:
                raise ValueError("No file path provided")
                
            if self.file_path.endswith('.csv'):
                self.df = pd.read_csv(self.file_path, encoding='utf-8')
            elif self.file_path.endswith('.xlsx'):
                self.df = pd.read_excel(self.file_path)
            else:
                raise ValueError("Unsupported file format. Use CSV or Excel (.xlsx)")
            
            if self.df is None or self.df.empty:
                raise ValueError("File is empty or contains no valid data")
                
            logging.info(f"Data loaded successfully: {self.df.shape[0]} rows, {self.df.shape[1]} columns")
            self.clean_data()
            
        except FileNotFoundError as e:
            logging.error(f"File not found: {str(e)}")
            raise
        except Exception as e:
            logging.error(f"Error loading data: {str(e)}")
            raise ValueError(f"Error loading data: {str(e)}")

    def get_columns(self) -> List[str]:
        """Return list of available columns in the dataset"""
        if self.df is None:
            return []
        return list(self.df.columns)

    def detect_data_types(self) -> Dict[str, List[str]]:
        """
        Detect and categorize column data types.
        
        Returns:
            dict: Categorized columns as numeric, categorical, datetime, or text
        """
        if self.df is None or self.df.empty:
            return {'numeric': [], 'categorical': [], 'datetime': [], 'text': []}
            
        data_types = {'numeric': [], 'categorical': [], 'datetime': [], 'text': []}
        
        for col in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                data_types['numeric'].append(col)
            elif pd.api.types.is_datetime64_any_dtype(self.df[col]):
                data_types['datetime'].append(col)
            elif self.df[col].dtype == 'object':
                unique_ratio = self.df[col].nunique() / len(self.df) if len(self.df) > 0 else 0
                avg_length = self.df[col].dropna().str.len().mean() if self.df[col].notna().any() else 0
                
                if unique_ratio > 0.5 or avg_length > 50:
                    data_types['text'].append(col)
                else:
                    data_types['categorical'].append(col)
                    
        return data_types

    def clean_data(self) -> None:
        """Perform comprehensive data cleaning"""
        if self.df is None or self.df.empty:
            logging.warning("No data to clean")
            return
            
        logging.info("Starting data cleaning process")
        
        try:
            initial_rows = len(self.df)
            self.df = self.df.drop_duplicates()
            duplicates_removed = initial_rows - len(self.df)
            logging.info(f"Removed {duplicates_removed} duplicate rows")
            
            for col in self.df.columns:
                if pd.api.types.is_numeric_dtype(self.df[col]):
                    median = self.df[col].median() if self.df[col].notna().any() else 0
                    self.df[col].fillna(median, inplace=True)
                    logging.debug(f"Filled numeric NA in {col} with median: {median}")
                elif self.df[col].dtype == 'object':
                    mode = self.df[col].mode()[0] if not self.df[col].mode().empty else 'Unknown'
                    self.df[col].fillna(mode, inplace=True)
                    logging.debug(f"Filled categorical NA in {col} with mode: {mode}")
            
            text_cols = self.detect_data_types()['text']
            for col in text_cols:
                self.df[col] = self.df[col].str.strip()
                self.df[col] = self.df[col].str.replace(r'\s+', ' ', regex=True)
            
            logging.info("Data cleaning completed")
        except Exception as e:
            logging.error(f"Error in data cleaning: {str(e)}")
            raise

    def basic_statistics(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate comprehensive basic statistics.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Statistical summary of the data
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for statistics'}
            
        logging.info("Generating basic statistics")
        
        try:
            df_analyze = self.df[columns] if columns and all(col in self.df.columns for col in columns) else self.df
            
            stats_dict = {
                'shape': df_analyze.shape,
                'columns': list(df_analyze.columns),
                'dtypes': {col: str(dtype) for col, dtype in df_analyze.dtypes.items()},
                'missing_values': df_analyze.isnull().sum().to_dict(),
                'numeric_summary': {},
                'data_types': self.detect_data_types()
            }
            
            numeric_cols = [col for col in df_analyze.columns if col in self.detect_data_types()['numeric']]
            for col in numeric_cols:
                col_data = df_analyze[col].dropna()
                if col_data.empty:
                    continue
                stats_dict['numeric_summary'][col] = {
                    'mean': float(col_data.mean()),
                    'median': float(col_data.median()),
                    'std': float(col_data.std()) if len(col_data) > 1 else 0,
                    'min': float(col_data.min()),
                    'max': float(col_data.max()),
                    'q25': float(col_data.quantile(0.25)),
                    'q75': float(col_data.quantile(0.75)),
                    'skewness': float(col_data.skew()) if len(col_data) > 1 else 0,
                    'kurtosis': float(col_data.kurtosis()) if len(col_data) > 1 else 0
                }
                
            return stats_dict
        except Exception as e:
            logging.error(f"Error generating statistics: {str(e)}")
            return {'error': str(e)}

    def categorical_summary(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate summary for categorical columns.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Summary of categorical data
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for categorical summary'}
            
        logging.info("Generating categorical summary")
        try:
            cat_cols = self.detect_data_types()['categorical']
            if columns:
                cat_cols = [col for col in columns if col in cat_cols and col in self.df.columns]
                
            summary = {}
            for col in cat_cols:
                col_data = self.df[col].dropna()
                if col_data.empty:
                    continue
                    
                mode = col_data.mode()
                value_counts = col_data.value_counts()
                
                summary[col] = {
                    'unique_values': int(col_data.nunique()),
                    'most_frequent': mode[0] if not mode.empty else None,
                    'frequency': int(value_counts.iloc[0]) if not value_counts.empty else 0,
                    'top_values': value_counts.head(10).to_dict(),
                    'entropy': float(stats.entropy(value_counts)) if not value_counts.empty else 0
                }
                
            return summary
        except Exception as e:
            logging.error(f"Error generating categorical summary: {str(e)}")
            return {'error': str(e)}

    def text_summary(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate summary for text columns.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Summary of text data
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for text summary'}
            
        logging.info("Generating text summary")
        try:
            text_cols = self.detect_data_types()['text']
            if columns:
                text_cols = [col for col in columns if col in text_cols and col in self.df.columns]
                
            summary = {}
            for col in text_cols:
                col_data = self.df[col].dropna()
                if col_data.empty:
                    continue
                    
                word_counts = col_data.str.split().str.len()
                
                summary[col] = {
                    'avg_length': float(col_data.str.len().mean()) if not col_data.empty else 0,
                    'avg_word_count': float(word_counts.mean()) if not word_counts.empty else 0,
                    'most_common_value': col_data.mode()[0] if not col_data.mode().empty else None,
                    'unique_values': int(col_data.nunique()),
                    'sample_values': col_data.head(3).tolist()
                }
                
            return summary
        except Exception as e:
            logging.error(f"Error generating text summary: {str(e)}")
            return {'error': str(e)}

    def datetime_summary(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate summary for datetime columns.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Summary of datetime data
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for datetime summary'}
            
        logging.info("Generating datetime summary")
        try:
            datetime_cols = self.detect_data_types()['datetime']
            if columns:
                datetime_cols = [col for col in columns if col in datetime_cols and col in self.df.columns]
                
            summary = {}
            for col in datetime_cols:
                col_data = pd.to_datetime(self.df[col], errors='coerce')
                if col_data.dropna().empty:
                    continue
                    
                time_diff = col_data.max() - col_data.min() if not col_data.isnull().all() else pd.Timedelta(0)
                
                summary[col] = {
                    'min_date': str(col_data.min()) if not col_data.isnull().all() else None,
                    'max_date': str(col_data.max()) if not col_data.isnull().all() else None,
                    'unique_dates': int(col_data.nunique()),
                    'missing_values': int(col_data.isnull().sum()),
                    'time_span_days': time_diff.days if not col_data.isnull().all() else 0,
                    'day_of_week_dist': col_data.dt.day_name().value_counts().to_dict() if not col_data.isnull().all() else {}
                }
                
            return summary
        except Exception as e:
            logging.error(f"Error generating datetime summary: {str(e)}")
            return {'error': str(e)}

    def data_quality_report(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate comprehensive data quality report.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Data quality metrics
        """
        if self.df is None or self.df.empty:
            return {
                'error': 'No data available for quality report',
                'missing_values': {},
                'total_missing_values': 0,
                'missing_percentage': 0,
                'duplicates': 0,
                'column_types': {},
                'empty_columns': [],
                'constant_columns': [],
                'cardinality': {}
            }
            
        logging.info("Generating data quality report")
        try:
            df_analyze = self.df[columns] if columns and all(col in self.df.columns for col in columns) else self.df
            
            missing_values = df_analyze.isnull().sum().to_dict()
            total_missing = sum(missing_values.values()) if missing_values else 0
            total_cells = len(df_analyze) * len(df_analyze.columns) if len(df_analyze) > 0 else 1
            
            return {
                'missing_values': missing_values,
                'total_missing_values': total_missing,
                'missing_percentage': (total_missing / total_cells * 100) if total_cells > 0 else 0,
                'duplicates': int(df_analyze.duplicated().sum()),
                'column_types': df_analyze.dtypes.astype(str).to_dict(),
                'empty_columns': [col for col in df_analyze.columns if df_analyze[col].isnull().all()],
                'constant_columns': [col for col in df_analyze.columns if df_analyze[col].nunique() == 1],
                'cardinality': {col: df_analyze[col].nunique() for col in df_analyze.columns}
            }
        except Exception as e:
            logging.error(f"Error generating data quality report: {str(e)}")
            return {
                'error': str(e),
                'missing_values': {},
                'total_missing_values': 0,
                'missing_percentage': 0,
                'duplicates': 0,
                'column_types': {},
                'empty_columns': [],
                'constant_columns': [],
                'cardinality': {}
            }

    def detect_outliers(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Detect outliers using IQR method for each numeric column.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Outlier information for each column
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for outlier detection'}
            
        logging.info("Detecting outliers")
        try:
            numeric_cols = self.detect_data_types()['numeric']
            if columns:
                numeric_cols = [col for col in columns if col in numeric_cols and col in self.df.columns]
                
            outliers_dict = {}
            for col in numeric_cols:
                try:
                    col_data = self.df[col].dropna()
                    if col_data.empty or not pd.api.types.is_numeric_dtype(col_data):
                        outliers_dict[col] = {
                            'iqr_outliers': {'count': 0, 'percentage': 0, 'values': []}
                        }
                        continue
                        
                    Q1 = col_data.quantile(0.25)
                    Q3 = col_data.quantile(0.75)
                    IQR = Q3 - Q1
                    iqr_outliers = col_data[(col_data < Q1 - 1.5 * IQR) | (col_data > Q3 + 1.5 * IQR)]
                    
                    outliers_dict[col] = {
                        'iqr_outliers': {
                            'count': len(iqr_outliers),
                            'percentage': (len(iqr_outliers) / len(self.df) * 100) if len(self.df) > 0 else 0,
                            'values': iqr_outliers.tolist()[:10]
                        }
                    }
                except Exception as e:
                    logging.error(f"Error detecting outliers for column {col}: {str(e)}")
                    outliers_dict[col] = {
                        'error': str(e),
                        'iqr_outliers': {'count': 0, 'percentage': 0, 'values': []}
                    }
                    
            return outliers_dict
        except Exception as e:
            logging.error(f"Error in outlier detection: {str(e)}")
            return {'error': str(e)}

    def correlation_analysis(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Perform comprehensive correlation analysis.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Correlation matrix and strong correlations
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for correlation analysis'}
            
        logging.info("Performing correlation analysis")
        try:
            numeric_cols = self.detect_data_types()['numeric']
            if columns:
                numeric_cols = [col for col in columns if col in numeric_cols and col in self.df.columns]
                
            if len(numeric_cols) < 2:
                return {'error': 'Need at least two numeric columns for correlation analysis'}
                
            df_numeric = self.df[numeric_cols].dropna()
            if df_numeric.empty:
                return {'error': 'No valid numeric data after dropping NA values'}
                
            correlation_matrix = df_numeric.corr(method='pearson')
            strong_correlations = []
            
            for i in range(len(correlation_matrix.columns)):
                for j in range(i + 1, len(correlation_matrix.columns)):
                    corr_value = correlation_matrix.iloc[i, j]
                    if np.isnan(corr_value):
                        continue
                        
                    strength = ''
                    if abs(corr_value) > 0.9:
                        strength = 'Very Strong'
                    elif abs(corr_value) > 0.7:
                        strength = 'Strong'
                    elif abs(corr_value) > 0.5:
                        strength = 'Moderate'
                    elif abs(corr_value) > 0.3:
                        strength = 'Weak'
                    else:
                        continue
                        
                    strong_correlations.append({
                        'column1': correlation_matrix.columns[i],
                        'column2': correlation_matrix.columns[j],
                        'correlation': float(corr_value),
                        'strength': strength,
                        'p_value': float(stats.pearsonr(
                            df_numeric[correlation_matrix.columns[i]],
                            df_numeric[correlation_matrix.columns[j]]
                        )[1]) if len(df_numeric) > 1 else 0
                    })
                    
            return {
                'correlation_matrix': correlation_matrix.to_dict(),
                'strong_correlations': strong_correlations,
                'heatmap_data': {
                    'columns': numeric_cols,
                    'values': correlation_matrix.values.tolist()
                }
            }
        except Exception as e:
            logging.error(f"Error in correlation analysis: {str(e)}")
            return {'error': str(e)}

    def generate_histogram(self, columns: Optional[List[str]] = None) -> Dict:
        """
        Generate histogram data for visualization.
        
        Args:
            columns (list): Optional list of columns to analyze
            
        Returns:
            dict: Histogram data for each column
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for histogram generation'}
            
        logging.info("Generating histogram data")
        try:
            numeric_cols = self.detect_data_types()['numeric']
            if columns:
                numeric_cols = [col for col in columns if col in numeric_cols and col in self.df.columns]
                
            histogram_data = {}
            for col in numeric_cols:
                try:
                    values = self.df[col].dropna()
                    if values.empty or not pd.api.types.is_numeric_dtype(values):
                        histogram_data[col] = {
                            'labels': [],
                            'counts': [],
                            'bin_edges': [],
                            'density': []
                        }
                        continue
                        
                    hist, bins = np.histogram(values, bins='auto')
                    histogram_data[col] = {
                        'labels': [f"{bins[i]:.2f}-{bins[i+1]:.2f}" for i in range(len(bins)-1)],
                        'counts': hist.tolist(),
                        'bin_edges': bins.tolist(),
                        'density': (hist / hist.sum()).tolist() if hist.sum() > 0 else hist.tolist()
                    }
                except Exception as e:
                    logging.error(f"Error generating histogram for column {col}: {str(e)}")
                    histogram_data[col] = {
                        'error': str(e),
                        'labels': [],
                        'counts': [],
                        'bin_edges': [],
                        'density': []
                    }
                    
            return histogram_data
        except Exception as e:
            logging.error(f"Error in histogram generation: {str(e)}")
            return {'error': str(e)}

    def generate_scatter_data(self, x_col: str, y_col: str) -> Dict:
        """
        Generate scatter plot data for two columns with validation.
        
        Args:
            x_col (str): X-axis column
            y_col (str): Y-axis column
            
        Returns:
            dict: Scatter plot data
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for scatter plot'}
            
        logging.info(f"Generating scatter data for {x_col} vs {y_col}")
        
        try:
            if x_col not in self.df.columns:
                return {'error': f"Column {x_col} not found in dataset"}
            if y_col not in self.df.columns:
                return {'error': f"Column {y_col} not found in dataset"}
            if not pd.api.types.is_numeric_dtype(self.df[x_col]):
                return {'error': f"Column {x_col} is not numeric"}
            if not pd.api.types.is_numeric_dtype(self.df[y_col]):
                return {'error': f"Column {y_col} is not numeric"}
                
            plot_data = self.df[[x_col, y_col]].dropna()
            if plot_data.empty:
                return {
                    'error': 'No valid data points after removing NA values',
                    'x_column': x_col,
                    'y_column': y_col,
                    'data': [],
                    'correlation': 0
                }
                
            return {
                'x_column': x_col,
                'y_column': y_col,
                'data': plot_data.to_dict(orient='records'),
                'correlation': float(plot_data.corr().iloc[0,1]) if len(plot_data) > 1 else 0
            }
        except Exception as e:
            logging.error(f"Error generating scatter data: {str(e)}")
            return {
                'error': str(e),
                'x_column': x_col,
                'y_column': y_col,
                'data': [],
                'correlation': 0
            }

    def ask_mistral(self, 
                   prompt: str, 
                   max_tokens: int = 1000, 
                   temperature: float = 0.7, 
                   context: Optional[str] = None) -> str:
        """
        Enhanced method to query Mistral AI with comprehensive error handling.
        
        Args:
            prompt (str): The question/instruction for Mistral
            max_tokens (int): Limit response length
            temperature (float): Creativity control (0-1)
            context (str): Previous conversation context
            
        Returns:
            str: Generated response or error message
        """
        if not prompt or not isinstance(prompt, str):
            logging.error("Invalid prompt provided to Mistral")
            return "Error: Invalid prompt"
            
        try:
            full_prompt = prompt
            if context:
                full_prompt = f"Context: {context}\n\nQuestion: {prompt}"
                
            command = [
                "ollama", "run", "mistral",
                f"--num-predict {max_tokens}",
                f"--temperature {temperature}",
                full_prompt
            ]
            
            logging.info(f"Querying Mistral with {len(full_prompt)} chars")
            result = subprocess.run(
                " ".join(command),
                shell=True,
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if result.returncode != 0:
                error_msg = f"Mistral error: {result.stderr.strip()}"
                logging.error(error_msg)
                return error_msg
                
            output = result.stdout.strip()
            logging.info(f"Mistral response: {output[:100]}...")
            
            self._last_prompt = prompt
            self._last_response = output
            
            return output
            
        except subprocess.TimeoutExpired:
            error_msg = "Mistral query timed out (120s)"
            logging.warning(error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Mistral query failed: {str(e)}"
            logging.error(error_msg)
            return error_msg

    def generate_insights(self, 
                        columns: Optional[List[str]] = None,
                        question: Optional[str] = None,
                        follow_up: bool = False,
                        max_tokens: int = 1000,
                        temperature: float = 0.7) -> Dict:
        """
        Generate comprehensive AI-driven insights with optional user question.
        
        Args:
            columns (list): Optional list of columns to analyze
            question (str): Optional specific question to ask Mistral
            follow_up (bool): Whether this is a follow-up question
            max_tokens (int): Maximum response length from Mistral
            temperature (float): Creativity control (0-1)
            
        Returns:
            dict: Structured insights including statistics and AI response
        """
        if self.df is None or self.df.empty:
            return {'error': 'No data available for insights generation'}
            
        logging.info("Starting AI insights generation")
        
        try:
            stats = self.basic_statistics(columns)
            if 'error' in stats:
                return {'error': 'Failed to generate statistics for insights'}
                
            outliers = self.detect_outliers(columns)
            correlations = self.correlation_analysis(columns)
            data_quality = self.data_quality_report(columns)
            categorical = self.categorical_summary(columns)
            
            prompt_parts = [
                "ROLE: You are a senior data analyst with 10+ years experience.",
                "TASK: Analyze this dataset and provide actionable insights.",
                "",
                "DATASET CHARACTERISTICS:",
                f"- Rows: {self.df.shape[0]:,}",
                f"- Columns: {self.df.shape[1]:,}",
                f"- Numeric columns: {len(stats['data_types']['numeric'])}",
                f"- Categorical columns: {len(stats['data_types']['categorical'])}",
                ""
            ]
            
            if stats['numeric_summary']:
                prompt_parts.append("KEY STATISTICS:")
                for col, vals in stats['numeric_summary'].items():
                    prompt_parts.append(
                        f"{col}: Mean={vals['mean']:.2f}, "
                        f"SD={vals['std']:.2f}, "
                        f"Range=[{vals['min']:.2f}-{vals['max']:.2f}]"
                    )
            
            if data_quality['total_missing_values'] > 0:
                prompt_parts.extend([
                    "",
                    "DATA QUALITY ISSUES:",
                    f"- {data_quality['total_missing_values']} missing values "
                    f"({data_quality['missing_percentage']:.1f}% of data)",
                    f"- {data_quality['duplicates']} duplicate rows found"
                ])
            
            if correlations.get('strong_correlations'):
                prompt_parts.extend([
                    "",
                    "NOTABLE CORRELATIONS:"
                ])
                for corr in correlations['strong_correlations'][:3]:
                    prompt_parts.append(
                        f"- {corr['column1']} & {corr['column2']}: "
                        f"r={corr['correlation']:.2f} ({corr['strength']})"
                    )
            
            if categorical:
                prompt_parts.extend([
                    "",
                    "CATEGORICAL DISTRIBUTIONS:"
                ])
                for col, info in categorical.items():
                    prompt_parts.append(
                        f"- {col}: {info['unique_values']} unique values, "
                        f"most frequent = {info['most_frequent']} "
                        f"({info['frequency']} occurrences)"
                    )
            
            if question:
                prompt_parts.extend([
                    "",
                    f"USER QUESTION: {question}"
                ])
            
            if follow_up and self._last_response:
                prompt_parts.extend([
                    "",
                    "PREVIOUS ANALYSIS CONTEXT:",
                    self._last_response[:500] + "..."
                ])
            
            prompt_parts.extend([
                "",
                "RESPONSE REQUIREMENTS:",
                "1. Key findings (bullet points)",
                "2. 3 most interesting patterns",
                "3. Suggested visualizations with justifications",
                "4. Data quality recommendations",
                "5. Answer any specific user questions",
                "6. Format with clear section headings",
                "",
                "OUTPUT FORMAT:",
                "Use Markdown with headings (##) for sections"
            ])
            
            full_prompt = "\n".join(prompt_parts)
            logging.info(f"Generated prompt: {full_prompt[:200]}...")
            
            ai_response = self.ask_mistral(
                prompt=full_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                context=None if not follow_up else self._last_prompt
            )
            
            insights = {
                'summary_statistics': stats.get('numeric_summary', {}),
                'data_quality': {
                    'missing_values': data_quality.get('missing_values', {}),
                    'total_missing': data_quality.get('total_missing_values', 0),
                    'duplicates': data_quality.get('duplicates', 0)
                },
                'correlations': correlations.get('strong_correlations', [])[:5],
                'outliers': {
                    col: info['iqr_outliers']['count'] 
                    for col, info in outliers.items() if 'iqr_outliers' in info
                },
                'ai_response': ai_response,
                'suggested_visualizations': self._extract_visualization_suggestions(ai_response),
                'follow_up_questions': self._generate_follow_up_questions(stats, correlations),
                'timestamp': pd.Timestamp.now().isoformat()
            }
            
            self._last_prompt = full_prompt
            self._last_response = ai_response
            
            return insights
            
        except Exception as e:
            logging.error(f"Error generating insights: {str(e)}")
            return {
                'error': str(e),
                'traceback': traceback.format_exc(),
                'summary_statistics': {},
                'data_quality': {},
                'correlations': [],
                'outliers': {},
                'ai_response': '',
                'suggested_visualizations': [],
                'follow_up_questions': []
            }

    def _extract_visualization_suggestions(self, ai_response: str) -> List[Dict]:
        """
        Parse AI response for visualization suggestions.
        
        Args:
            ai_response (str): Response from Mistral
            
        Returns:
            list: Suggested visualizations with reasons
        """
        if not ai_response or not isinstance(ai_response, str):
            return []
            
        visuals = []
        patterns = [
            (r'(histogram|distribution).*?(should|recommend|useful)', 'histogram'),
            (r'(scatter plot|scattergram).*?(should|recommend|useful)', 'scatter'),
            (r'(bar (chart|graph)).*?(should|recommend|useful)', 'bar'),
            (r'(line (chart|graph)).*?(should|recommend|useful)', 'line'),
            (r'(box plot|boxplot).*?(should|recommend|useful)', 'box'),
            (r'(correlation matrix|heatmap).*?(should|recommend|useful)', 'heatmap'),
            (r'(pie chart).*?(should|recommend|useful)', 'pie')
        ]
        
        for pattern, viz_type in patterns:
            if re.search(pattern, ai_response, re.IGNORECASE):
                match = re.search(pattern, ai_response, re.IGNORECASE)
                context = ai_response[max(0, match.start()-50):match.end()+50]
                visuals.append({
                    'type': viz_type,
                    'reason': context.strip()
                })
                
        return visuals

    def _generate_follow_up_questions(self, stats: Dict, correlations: Dict) -> List[str]:
        """
        Generate suggested follow-up questions based on analysis.
        
        Args:
            stats (dict): Basic statistics
            correlations (dict): Correlation analysis
            
        Returns:
            list: Suggested follow-up questions
        """
        questions = []
        if 'error' in stats or not stats.get('data_types'):
            return questions
            
        questions = [
            "What is the relationship between [column1] and [column2]?",
            "Are there any seasonal patterns in the data?",
            "What factors might explain the outliers in [column]?"
        ]
        
        numeric_cols = stats['data_types'].get('numeric', [])
        cat_cols = stats['data_types'].get('categorical', [])
        
        if numeric_cols:
            questions.append(f"What is the distribution of {numeric_cols[0]}?")
            
        if correlations.get('strong_correlations'):
            top_corr = correlations['strong_correlations'][0]
            questions.append(
                f"What explains the correlation between {top_corr['column1']} and {top_corr['column2']}?"
            )
            
        return questions[:5]

    def generate_report(self, 
                      columns: Optional[List[str]] = None,
                      question: Optional[str] = None,
                      format: str = 'dict') -> Union[Dict, str]:
        """
        Generate a comprehensive analysis report in multiple formats.
        
        Args:
            columns (list): Optional list of columns to analyze
            question (str): Optional specific question to answer
            format (str): Output format ('dict', 'json', or 'html')
            
        Returns:
            Union[Dict, str]: Report in requested format
        """
        if self.df is None or self.df.empty:
            error_response = {
                'error': 'No data available for report generation',
                'metadata': {'timestamp': pd.Timestamp.now().isoformat()}
            }
            if format == 'html':
                return f"<html><body><h1>Error</h1><p>No data available</p></body></html>"
            return error_response
            
        logging.info(f"Generating {format.upper()} report")
        
        try:
            report_data = {
                'metadata': {
                    'file_path': self.file_path,
                    'timestamp': pd.Timestamp.now().isoformat(),
                    'columns_analyzed': columns if columns else list(self.df.columns),
                    'rows_analyzed': len(self.df)
                },
                'basic_statistics': self.basic_statistics(columns),
                'categorical_summary': self.categorical_summary(columns),
                'data_quality': self.data_quality_report(columns),
                'outliers': self.detect_outliers(columns),
                'correlations': self.correlation_analysis(columns),
                'insights': self.generate_insights(columns, question)
            }
            
            numeric_cols = self.detect_data_types()['numeric']
            if len(numeric_cols) >= 1:
                report_data['histogram_data'] = self.generate_histogram(columns)
            if len(numeric_cols) >= 2:
                report_data['scatter_data'] = self.generate_scatter_data(numeric_cols[0], numeric_cols[1])
            
            if format == 'dict':
                return report_data
            elif format == 'json':
                return json.dumps(report_data, indent=2)
            elif format == 'html':
                return self._generate_html_report(report_data)
            else:
                raise ValueError(f"Unsupported format: {format}. Use 'dict', 'json', or 'html'")
                
        except Exception as e:
            logging.error(f"Report generation failed: {str(e)}")
            error_response = {
                'error': str(e),
                'metadata': {
                    'timestamp': pd.Timestamp.now().isoformat(),
                    'file_path': self.file_path
                }
            }
            if format == 'html':
                return f"<html><body><h1>Error</h1><pre>{error_response}</pre></body></html>"
            return error_response

    def _generate_html_report(self, report_data: Dict) -> str:
        """Generate HTML version of the report"""
        try:
            stats_summary = ""
            for col, stats in report_data['basic_statistics'].get('numeric_summary', {}).items():
                stats_summary += f"""
                    <div>
                        <h3>{col}</h3>
                        <p>Mean: {stats['mean']:.2f}, Median: {stats['median']:.2f}, 
                        Std: {stats['std']:.2f}</p>
                    </div>
                """
                
            corr_html = "<table><tr><th>Column 1</th><th>Column 2</th><th>Correlation</th></tr>"
            for corr in report_data['correlations'].get('strong_correlations', [])[:5]:
                corr_html += f"<tr><td>{corr['column1']}</td><td>{corr['column2']}</td><td>{corr['correlation']:.2f}</td></tr>"
            corr_html += "</table>"
            
            insights_html = markdown.markdown(report_data['insights'].get('ai_response', '')) if report_data['insights'].get('ai_response') else "<p>No AI insights available</p>"
            
            html_template = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Data Analysis Report</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }}
                    h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; }}
                    h2, h3 {{ color: #2980b9; }}
                    .section {{ margin-bottom: 30px; }}
                    table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
                    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                    th {{ background-color: #f2f2f2; }}
                    .insights {{ background-color: #f9f9f9; padding: 15px; border-radius: 5px; }}
                    .warning {{ color: #e74c3c; font-weight: bold; }}
                </style>
            </head>
            <body>
                <h1>Data Analysis Report</h1>
                <p><strong>Generated:</strong> {report_data['metadata']['timestamp']}</p>
                <p><strong>Dataset:</strong> {report_data['metadata']['file_path']}</p>
                
                <div class="section">
                    <h2>Basic Statistics</h2>
                    <p>Dataset shape: {report_data['basic_statistics'].get('shape', (0,0))}</p>
                    {stats_summary}
                </div>
                
                <div class="section">
                    <h2>Data Quality</h2>
                    <p>Missing values: {report_data['data_quality'].get('total_missing_values', 0)} 
                    ({report_data['data_quality'].get('missing_percentage', 0):.1f}%)</p>
                    <p>Duplicate rows: {report_data['data_quality'].get('duplicates', 0)}</p>
                </div>
                
                <div class="section">
                    <h2>Key Correlations</h2>
                    {corr_html}
                </div>
                
                <div class="section">
                    <h2>AI Insights</h2>
                    <div class='insights'>{insights_html}</div>
                </div>
                
                <div class="section">
                    <h2>Suggested Visualizations</h2>
                    <ul>
                        {''.join(f"<li><strong>{viz['type']}</strong>: {viz['reason']}</li>" 
                                for viz in report_data['insights'].get('suggested_visualizations', []))}
                    </ul>
                </div>
            </body>
            </html>
            """
            
            return html_template
            
        except Exception as e:
            logging.error(f"HTML report generation failed: {str(e)}")
            return f"<html><body><h1>Error</h1><p>{str(e)}</p></body></html>"

if __name__ == '__main__':
    try:
        analyzer = DataAnalyzer('example_data.csv')
        report = analyzer.generate_report()
        print(json.dumps(report, indent=2))
        
        with open('analysis_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        insights = analyzer.generate_insights(question="What are the key trends in this data?")
        print("\nAI Insights:", insights['ai_response'])
        
    except Exception as e:
        print(f"Error: {str(e)}")