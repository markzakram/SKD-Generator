"""The same plain-text representation as the original tryout import."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('extract_tryouts', Path(__file__).with_name('extract-tryouts.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
text, W = module.text, module.W
