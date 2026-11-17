"""Build a tiny Qwen3-architecture model + byte-level BPE tokenizer entirely offline.

Used to exercise the real Trainer/PEFT/generate code paths on CPU. Its outputs are
meaningless; only the wiring (gates, masks, hashing, saving, inspection) is validated.
"""
from __future__ import annotations

from pathlib import Path

# Mirrors the Qwen3 template's behavior for the final assistant turn and enable_thinking=False.
CHAT_TEMPLATE = (
    "{%- for message in messages %}"
    "{%- if message.role == 'assistant' and loop.last %}"
    "{{- '<|im_start|>assistant\\n<think>\\n\\n</think>\\n\\n' + message.content + '<|im_end|>\\n' }}"
    "{%- else %}"
    "{{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>\\n' }}"
    "{%- endif %}"
    "{%- endfor %}"
    "{%- if add_generation_prompt %}{{- '<|im_start|>assistant\\n' }}"
    "{%- if enable_thinking is defined and enable_thinking is false %}{{- '<think>\\n\\n</think>\\n\\n' }}{%- endif %}"
    "{%- endif %}"
)
# Qwen2/3 pre-tokenizer split pattern (keeps "\n\n" as one pre-token → prefix-stable tokenization).
QWEN_SPLIT = (r"(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+")


def build_tiny_qwen3(out: Path, corpus: list[str]) -> Path:
    import torch
    from tokenizers import Regex, Tokenizer, decoders, models, pre_tokenizers, trainers
    from transformers import PreTrainedTokenizerFast, Qwen3Config, Qwen3ForCausalLM

    specials = ["<|endoftext|>", "<|im_start|>", "<|im_end|>"]
    tk = Tokenizer(models.BPE())
    tk.pre_tokenizer = pre_tokenizers.Sequence([
        pre_tokenizers.Split(Regex(QWEN_SPLIT), behavior="isolated"),
        pre_tokenizers.ByteLevel(add_prefix_space=False, use_regex=False)])
    tk.decoder = decoders.ByteLevel()
    tk.train_from_iterator(corpus * 3, trainers.BpeTrainer(vocab_size=700, special_tokens=specials,
                                                           initial_alphabet=pre_tokenizers.ByteLevel.alphabet()))
    tok = PreTrainedTokenizerFast(tokenizer_object=tk, eos_token="<|im_end|>", pad_token="<|endoftext|>",
                                  chat_template=CHAT_TEMPLATE)
    out.mkdir(parents=True, exist_ok=True)
    tok.save_pretrained(out)
    torch.manual_seed(0)
    cfg = Qwen3Config(vocab_size=len(tok), hidden_size=64, intermediate_size=128, num_hidden_layers=2,
                      num_attention_heads=4, num_key_value_heads=2, head_dim=16, max_position_embeddings=4096,
                      tie_word_embeddings=True, eos_token_id=tok.eos_token_id, pad_token_id=tok.pad_token_id)
    model = Qwen3ForCausalLM(cfg)
    model.save_pretrained(out, safe_serialization=True)
    return out
