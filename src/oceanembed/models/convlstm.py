"""
Convolutional LSTM (ConvLSTM) Temporal Module for OceanEmbed.
Maintains 2D spatial topology while capturing temporal transitions,
ocean heat content memory, and surface forcing dynamics across the T-day window.
"""

from typing import Tuple, List, Optional
import torch
import torch.nn as nn


class ConvLSTMCell(nn.Module):
    """
    A single ConvLSTM cell.
    Formula:
        i_t = sigma(W_xi * X_t + W_hi * H_{t-1} + b_i)
        f_t = sigma(W_xf * X_t + W_hf * H_{t-1} + b_f)
        c~_t = tanh(W_xc * X_t + W_hc * H_{t-1} + b_c)
        c_t = f_t * c_{t-1} + i_t * c~_t
        o_t = sigma(W_xo * X_t + W_ho * H_{t-1} + b_o)
        h_t = o_t * tanh(c_t)
    """
    def __init__(self, in_channels: int, hidden_dim: int, kernel_size: int = 3):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_dim = hidden_dim
        padding = kernel_size // 2
        
        # Combined convolution for all 4 gates (i, f, c~, o) for maximum computational efficiency
        self.conv = nn.Conv2d(
            in_channels=in_channels + hidden_dim,
            out_channels=4 * hidden_dim,
            kernel_size=kernel_size,
            padding=padding,
            bias=True
        )

    def forward(
        self,
        x: torch.Tensor,
        state: Optional[Tuple[torch.Tensor, torch.Tensor]] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: [B, in_channels, H, W]
            state: Tuple of (h, c), each [B, hidden_dim, H, W]
        Returns:
            (h_next, c_next)
        """
        B, _, H, W = x.shape
        if state is None:
            h = torch.zeros(B, self.hidden_dim, H, W, device=x.device, dtype=x.dtype)
            c = torch.zeros(B, self.hidden_dim, H, W, device=x.device, dtype=x.dtype)
        else:
            h, c = state

        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)
        
        i_gate, f_gate, c_tilde, o_gate = torch.chunk(gates, 4, dim=1)
        
        i = torch.sigmoid(i_gate)
        f = torch.sigmoid(f_gate)
        c_next = f * c + i * torch.tanh(c_tilde)
        o = torch.sigmoid(o_gate)
        h_next = o * torch.tanh(c_next)
        
        return h_next, c_next


class ConvLSTM(nn.Module):
    """
    Multi-layer Convolutional LSTM.
    Input: [B, T, in_channels, H, W]
    Output: [B, hidden_dim, H, W] (last hidden state)
    """
    def __init__(
        self,
        in_channels: int = 256,
        hidden_dim: int = 256,
        num_layers: int = 1,
        kernel_size: int = 3
    ):
        super().__init__()
        self.in_channels = in_channels
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        layers = []
        for l in range(num_layers):
            cur_in = in_channels if l == 0 else hidden_dim
            layers.append(ConvLSTMCell(cur_in, hidden_dim, kernel_size=kernel_size))
        self.cells = nn.ModuleList(layers)

    def forward(
        self,
        x: torch.Tensor,
        return_sequence: bool = False
    ) -> torch.Tensor:
        """
        Args:
            x: Tensor of shape [B, T, in_channels, H, W]
            return_sequence: If True, returns [B, T, hidden_dim, H, W]
        Returns:
            Tensor of shape [B, hidden_dim, H, W] or [B, T, hidden_dim, H, W]
        """
        B, T, _, H, W = x.shape
        
        # Initialize hidden states for all layers
        states: List[Optional[Tuple[torch.Tensor, torch.Tensor]]] = [None] * self.num_layers
        
        seq_out = []
        current_input = x
        
        for l, cell in enumerate(self.cells):
            layer_outputs = []
            state = states[l]
            for t in range(T):
                step_x = current_input[:, t] if l == 0 else current_input[t]
                h, c = cell(step_x, state)
                state = (h, c)
                layer_outputs.append(h)
            states[l] = state
            current_input = layer_outputs  # list of T tensors of [B, hidden_dim, H, W]
            
        if return_sequence:
            return torch.stack(current_input, dim=1)  # [B, T, hidden_dim, H, W]
        else:
            return current_input[-1]  # [B, hidden_dim, H, W]
