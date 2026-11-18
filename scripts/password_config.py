"""Validate verifier-only settings before publishing or embedding them."""
import json
import re

def load_config(path):
    data = json.loads(path.read_text(encoding='utf8'))
    if not isinstance(data, dict) or type(data.get('version')) is not int or data['version'] != 1 or type(data.get('enabled')) is not bool:
        raise ValueError('Invalid password configuration')
    expected = {'version', 'enabled'}
    if data['enabled']:
        expected |= {'algorithm', 'iterations', 'salt', 'digest'}
        if data.get('algorithm') != 'PBKDF2-SHA-256' or type(data.get('iterations')) is not int or not 100000 <= data['iterations'] <= 2000000:
            raise ValueError('Invalid password derivation parameters')
        if not isinstance(data.get('salt'), str) or not re.fullmatch('[a-f0-9]{32}', data['salt']) or not isinstance(data.get('digest'), str) or not re.fullmatch('[a-f0-9]{64}', data['digest']):
            raise ValueError('Invalid password verifier')
    if set(data) != expected:
        raise ValueError('Only verifier fields are permitted; never include a plaintext password')
    return data
