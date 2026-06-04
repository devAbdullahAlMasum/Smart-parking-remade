import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const serialPortPath = process.env.SERIAL_PORT || "COM3";
const serialBaudRate = Number(process.env.SERIAL_BAUD_RATE || 9600);

export function createSerialManager({ onLine }) {
  let port = null;
  let isConnected = false;

  try {
    port = new SerialPort({
      path: serialPortPath,
      baudRate: serialBaudRate,
      autoOpen: true,
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line) => onLine(line.trim()));

    port.on("open", () => {
      isConnected = true;
      console.log(`[serial] connected to ${serialPortPath}`);
    });

    port.on("close", () => {
      isConnected = false;
      console.log("[serial] disconnected");
    });

    port.on("error", (error) => {
      isConnected = false;
      console.error("[serial] error:", error.message);
    });
  } catch (error) {
    console.error("[serial] failed to open port:", error.message);
  }

  return {
    isConnected: () => isConnected,
    send(command) {
      if (!port || !isConnected) {
        console.warn(`[serial] skipped send while disconnected: ${command}`);
        return false;
      }

      port.write(`${command}\n`);
      return true;
    },
  };
}
