import { useState } from "react";

export default function useInputList(initial: string[] = []) {
  const [list, setList] = useState(initial);

  function add(item: string) {
    if (!item.trim()) return;
    setList((prev) => [...prev, item.trim()]);
  }

  function remove(index: number) {
    setList((prev) => prev.filter((_, i) => i !== index));
  }

  function update(index: number, value: string) {
    setList((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  return { list, add, remove, update };
}
