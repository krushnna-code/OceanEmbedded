"""
Spatial Grid Graph Builder for OceanEmbed.
Constructs spatial neighbourhood graphs over the North Indian Ocean 0.25° grid (101 x 241).
Supports 4-way and 8-way spatial adjacency for thermodynamic and dynamic GNN message passing.
"""

from typing import Tuple, Optional
import torch
import numpy as np

from oceanembed.data.interfaces import GRID_H, GRID_W


def build_grid_graph(
    h: int = GRID_H,
    w: int = GRID_W,
    connectivity: int = 8,
    device: Optional[torch.device] = None
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Builds spatial adjacency edge_index for a 2D ocean grid.
    Nodes are indexed in row-major order: node_id = row * W + col.
    
    Args:
        h: Height (number of latitude nodes, default 101)
        w: Width (number of longitude nodes, default 241)
        connectivity: 4 (cardinal neighbours: N, S, E, W) or 8 (including diagonals)
        device: PyTorch device
        
    Returns:
        edge_index: LongTensor of shape [2, num_edges]
        edge_weight: FloatTensor of shape [num_edges] (normalized spatial proximity)
    """
    num_nodes = h * w
    node_grid = torch.arange(num_nodes).view(h, w)
    
    src_list = []
    dst_list = []
    weights_list = []
    
    # 4-connectivity: N, S, E, W
    # Horizontal edges (East-West)
    src_h1 = node_grid[:, :-1].flatten()
    dst_h1 = node_grid[:, 1:].flatten()
    src_list.extend([src_h1, dst_h1])
    dst_list.extend([dst_h1, src_h1])
    weights_list.extend([torch.ones_like(src_h1, dtype=torch.float32), torch.ones_like(dst_h1, dtype=torch.float32)])
    
    # Vertical edges (North-South)
    src_v1 = node_grid[:-1, :].flatten()
    dst_v1 = node_grid[1:, :].flatten()
    src_list.extend([src_v1, dst_v1])
    dst_list.extend([dst_v1, src_v1])
    weights_list.extend([torch.ones_like(src_v1, dtype=torch.float32), torch.ones_like(dst_v1, dtype=torch.float32)])
    
    # Diagonal edges if connectivity == 8
    if connectivity == 8:
        diag_weight = 1.0 / np.sqrt(2.0)
        
        # Diagonal down-right (NW to SE)
        src_d1 = node_grid[:-1, :-1].flatten()
        dst_d1 = node_grid[1:, 1:].flatten()
        src_list.extend([src_d1, dst_d1])
        dst_list.extend([dst_d1, src_d1])
        weights_list.extend([
            torch.full_like(src_d1, diag_weight, dtype=torch.float32),
            torch.full_like(dst_d1, diag_weight, dtype=torch.float32)
        ])
        
        # Diagonal down-left (NE to SW)
        src_d2 = node_grid[:-1, 1:].flatten()
        dst_d2 = node_grid[1:, :-1].flatten()
        src_list.extend([src_d2, dst_d2])
        dst_list.extend([dst_d2, src_d2])
        weights_list.extend([
            torch.full_like(src_d2, diag_weight, dtype=torch.float32),
            torch.full_like(dst_d2, diag_weight, dtype=torch.float32)
        ])
        
    src_all = torch.cat(src_list)
    dst_all = torch.cat(dst_list)
    weights_all = torch.cat(weights_list)
    
    edge_index = torch.stack([src_all, dst_all], dim=0)
    
    if device is not None:
        edge_index = edge_index.to(device)
        weights_all = weights_all.to(device)
        
    return edge_index, weights_all


def compute_expected_edge_count(h: int = GRID_H, w: int = GRID_W, connectivity: int = 8) -> int:
    """
    Computes theoretical directed edge count for regular grid:
    - 4-conn: 2 * (h*(w-1) + (h-1)*w)
    - 8-conn: 4-conn + 4 * (h-1)*(w-1)
    """
    h_edges = h * (w - 1)
    v_edges = (h - 1) * w
    cardinal = 2 * (h_edges + v_edges)
    if connectivity == 4:
        return cardinal
    diag = 4 * (h - 1) * (w - 1)
    return cardinal + diag
