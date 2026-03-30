*** Settings ***
Documentation    Smoke tests API backend Auto Diagnostic Platform
Resource         ../resources/keywords.robot

Suite Setup      Create API Session

*** Test Cases ***
Root Endpoint Returns Service Info
    ${resp}=    GET On Session    backend    /
    Should Be Equal As Integers    ${resp.status_code}    200
    ${data}=    Set Variable    ${resp.json()}
    Should Be Equal    ${data['status']}    ok
    Should Be Equal    ${data['version']}    1.0.0

Create Tables Endpoint Is Reachable
    Ensure Database Ready

Register Login And Me Flow
    Ensure Database Ready
    ${email}=    Get Unique Email

    ${register_resp}=    Register User    ${email}    admin
    ${register_data}=    Set Variable    ${register_resp.json()}
    Should Be Equal    ${register_data['status']}    success
    Dictionary Should Contain Key    ${register_data}    access_token

    ${login_resp}=    Login User    ${email}
    ${login_data}=    Set Variable    ${login_resp.json()}
    Should Be Equal    ${login_data['status']}    success
    Should Be Equal    ${login_data['email']}    ${email}

    ${me_resp}=    Get Me    ${login_data['access_token']}
    ${me_data}=    Set Variable    ${me_resp.json()}
    Should Be Equal    ${me_data['status']}    success
    Should Be Equal    ${me_data['email']}    ${email}
