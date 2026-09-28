import urllib.request
import urllib.parse
from html.parser import HTMLParser
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

print("openpyxl imported successfully:", openpyxl.__version__)
