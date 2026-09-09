"""
Random seed management and reproducibility utilities.
"""

import os
import random
import numpy as np
import torch


def seed_everything(seed: int = 42) -> None:
    """Sets random seeds across python, numpy, and pytorch for reproducibility."""
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
