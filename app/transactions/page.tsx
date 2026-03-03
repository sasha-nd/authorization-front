"use client";

import { useState } from "react";

export default function TransactionsPage() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const handleTransfer = () => {
    // Placeholder: call your API to transfer money
    alert(`Transfer ${amount} to ${recipient}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-start p-6">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md flex flex-col gap-4">
        <h1 className="text-2xl font-bold mb-4">Transfer Money</h1>

        <input
          type="text"
          placeholder="Recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />

        <button
          onClick={handleTransfer}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Transfer
        </button>
      </div>
    </div>
  );
}